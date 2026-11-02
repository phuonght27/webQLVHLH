import json
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import Assignment, Allocation, Attachment, Classroom, Enrollment, Schedule, Session, Submission
from . import tests as legacy_tests


class HomeworkTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        legacy_tests.WorkflowTests.setUpTestData.__func__(cls)
        cls.second_class = Classroom.objects.create(course=cls.course, teacher=cls.teacher,
            manager=cls.manager, start_date=cls.classroom.start_date, end_date=cls.classroom.end_date)
        schedule = Schedule.objects.create(classroom=cls.second_class, shift=cls.shift, room=cls.room)
        cls.second_session = Session.objects.create(schedule=schedule, classroom=cls.second_class,
            shift=cls.shift, room=cls.room, date=timezone.localdate(), number=1)
        cls.second_member = Enrollment.objects.create(classroom=cls.second_class, student=cls.student)

    def setUp(self):
        self.media = tempfile.mkdtemp(prefix="homework-test-")
        override = override_settings(MEDIA_ROOT=self.media)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(lambda: shutil.rmtree(self.media, ignore_errors=True))
        self.client.force_login(self.teacher)

    def payload(self):
        return {"title": "Bài tập giao nhiều lớp", "description": "Đọc đề và nộp file PDF.",
            "classes": [
                {"classroom": self.classroom.pk, "session": self.allocation.session_id,
                 "deadline": (timezone.now() + timedelta(days=2)).isoformat()},
                {"classroom": self.second_class.pk, "session": self.second_session.pk,
                 "deadline": (timezone.now() + timedelta(days=4)).isoformat()},
            ]}

    def pdf(self, name="bai-lam.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4\nHomework content", content_type="application/pdf")

    def post_json(self, url, data):
        return self.client.post(url, json.dumps(data), content_type="application/json")

    def upload(self, file=None):
        return self.client.post(f"/api/homework/{self.allocation.pk}/files/", {"files": [file or self.pdf()]})

    def test_create_once_for_multiple_classes_with_independent_deadlines(self):
        response = self.client.post("/api/homework/", {"payload": json.dumps(self.payload()), "files": [self.pdf("de-bai.pdf")]})
        self.assertEqual(response.status_code, 201, response.content)
        assignment = Assignment.objects.get(pk=response.json()["id"])
        allocations = list(Allocation.objects.filter(assignment=assignment).order_by("deadline"))
        self.assertEqual(len(allocations), 2)
        self.assertNotEqual(allocations[0].deadline, allocations[1].deadline)
        self.assertEqual(Attachment.objects.filter(assignment=assignment).count(), 1)
        self.client.force_login(self.student)
        rows = self.client.get("/api/homework/").json()["rows"]
        self.assertEqual(sum(row["assignment_id"] == assignment.pk for row in rows), 2)

    def test_wrong_class_session_rolls_back_entire_assignment(self):
        payload = self.payload()
        payload["classes"][1]["session"] = self.allocation.session_id
        count = Assignment.objects.count()
        response = self.client.post("/api/homework/", {"payload": json.dumps(payload)})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Assignment.objects.count(), count)

    def test_teacher_cannot_assign_someone_elses_class(self):
        self.second_class.teacher = self.other
        self.second_class.save()
        response = self.client.post("/api/homework/", {"payload": json.dumps(self.payload())})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Assignment.objects.filter(title=self.payload()["title"]).exists())

    def test_student_cannot_create_or_inspect_other_students_work(self):
        self.client.force_login(self.student)
        self.assertEqual(self.client.post("/api/homework/", {"payload": json.dumps(self.payload())}).status_code, 403)
        self.assertEqual(self.client.get("/api/homework/?options=1").status_code, 403)
        self.upload()
        self.client.force_login(self.stranger)
        self.assertEqual(self.client.get(f"/api/homework/{self.allocation.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/homework/").json()["rows"], [])
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f"/api/homework/{self.allocation.pk}/").status_code, 404)

    def test_draft_confirm_feedback_and_student_permissions(self):
        self.client.force_login(self.student)
        url = f"/api/homework/{self.allocation.pk}/"
        self.assertEqual(self.post_json(url + "submit/", {}).status_code, 400)
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.content)
        file_id = response.json()["files"][0]["id"]
        sub = Submission.objects.get(allocation=self.allocation)
        self.assertIsNone(sub.submitted_at)
        self.client.force_login(self.teacher)
        students = self.client.get(url).json()["students"]
        self.assertEqual(students[0]["files"], [])
        self.assertEqual(self.client.get(f"/api/files/{file_id}/").status_code, 403)
        self.assertEqual(self.post_json("/api/comments/", {"submission": sub.pk, "content": "Draft"}).status_code, 400)
        self.client.force_login(self.student)
        self.assertEqual(self.post_json(url + "submit/", {}).status_code, 200)
        self.assertEqual(self.upload(self.pdf("extra.pdf")).status_code, 400)
        self.assertEqual(self.client.delete(url + f"files/{file_id}/").status_code, 400)
        self.client.force_login(self.teacher)
        students = self.client.get(url).json()["students"]
        self.assertEqual(students[0]["files"][0]["id"], file_id)
        response = self.post_json("/api/comments/", {"submission": sub.pk, "content": "Làm tốt, cần xem lại câu 2."})
        self.assertEqual(response.status_code, 200, response.content)
        comment_id = response.json()["id"]
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(url).json()["submission"]["comments"][0]["content"], "Làm tốt, cần xem lại câu 2.")
        self.assertEqual(self.client.get("/api/homework/").json()["rows"][-1]["comments"][0]["id"], comment_id)
        self.assertEqual(self.client.patch(f"/api/comments/{comment_id}/", json.dumps({"content": "Fake"}), content_type="application/json").status_code, 403)

    def test_duplicate_bad_type_and_too_many_files_do_not_change_draft(self):
        self.client.force_login(self.student)
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(self.upload().status_code, 400)
        self.assertEqual(self.upload(SimpleUploadedFile("fake.pdf", b"not PDF")).status_code, 400)
        response = self.client.post(f"/api/homework/{self.allocation.pk}/files/", {"files": [self.pdf(f"{i}.pdf") for i in range(10)]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Attachment.objects.count(), 1)
        self.assertEqual(self.upload(self.pdf("bad:name.pdf")).status_code, 400)
        self.assertEqual(Attachment.objects.count(), 1)

    def test_cancel_preserves_files_and_rejects_after_deadline(self):
        self.client.force_login(self.student)
        self.upload()
        url = f"/api/homework/{self.allocation.pk}/"
        self.post_json(url + "submit/", {})
        self.assertEqual(self.client.delete(url + "submit/").status_code, 200)
        self.assertEqual(Attachment.objects.count(), 1)
        self.assertTrue(self.client.get(url).json()["can_submit"])
        Allocation.objects.filter(pk=self.allocation.pk).update(deadline=timezone.now() - timedelta(hours=1))
        self.assertEqual(self.post_json(url + "submit/", {}).status_code, 200)
        self.assertEqual(self.client.get(url).json()["submission"]["status"], "Nộp muộn")
        self.assertEqual(self.client.delete(url + "submit/").status_code, 400)

    def test_left_student_can_read_but_not_submit(self):
        Enrollment.objects.filter(pk=self.member.pk).update(left_at=timezone.now())
        self.client.force_login(self.student)
        response = self.client.get(f"/api/homework/{self.allocation.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["can_submit"])
        self.assertEqual(self.upload().status_code, 400)

    def test_feedback_edits_and_deletion_update_student_detail(self):
        self.client.force_login(self.student)
        self.upload()
        url = f"/api/homework/{self.allocation.pk}/"
        self.post_json(url + "submit/", {})
        sub = Submission.objects.get(allocation=self.allocation)
        self.client.force_login(self.teacher)
        comment_id = self.post_json("/api/comments/", {"submission": sub.pk, "content": "Nhận xét ban đầu"}).json()["id"]
        response = self.client.patch(f"/api/comments/{comment_id}/", json.dumps({"submission": sub.pk, "content": "Đã sửa nhận xét"}), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(url).json()["submission"]["comments"][0]["content"], "Đã sửa nhận xét")
        self.assertEqual(self.client.post(f"/api/submissions/{sub.pk}/upload/", {"file": self.pdf("bypass.pdf")}).status_code, 400)
        self.client.force_login(self.teacher)
        self.assertEqual(self.client.delete(f"/api/comments/{comment_id}/").status_code, 200)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(url).json()["submission"]["comments"], [])

    def test_deleted_assignment_cannot_receive_upload(self):
        Assignment.objects.filter(pk=self.assignment.pk).update(deleted_at=timezone.now())
        self.client.force_login(self.student)
        self.assertEqual(self.upload().status_code, 404)
        self.assertFalse(Attachment.objects.exists())
