import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from . import tests as legacy_tests
from .models import Assignment, Allocation, Classroom, Submission


class ProgressScreenTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        legacy_tests.WorkflowTests.setUpTestData.__func__(cls)

    def get_progress(self, user):
        self.client.force_login(user)
        response = self.client.get("/api/progress/")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_class_and_session_options_obey_existing_scope(self):
        visible = self.get_progress(self.teacher)
        self.assertEqual([c["id"] for c in visible["classes"]], [self.classroom.pk])
        self.assertTrue(visible["sessions"])
        self.assertTrue(all(s["classroom_id"] == self.classroom.pk for s in visible["sessions"]))
        hidden = self.get_progress(self.other)
        self.assertEqual(hidden["rows"], [])
        self.assertEqual(hidden["classes"], [])
        self.assertEqual(hidden["sessions"], [])
        self.assertEqual(hidden["allocations"], [])
        student = self.get_progress(self.student)
        self.assertEqual(student["rows"][0]["student_code"], self.student.username)
        self.assertEqual(self.get_progress(self.stranger)["classes"], [])

    def test_row_metadata_preserves_existing_status_and_student_identity(self):
        response = self.get_progress(self.teacher)
        row = response["rows"][0]
        self.assertEqual(row["student_name"], self.student.full_name)
        self.assertEqual(row["student"], str(self.student))
        self.assertEqual(row["session_id"], self.allocation.session_id)
        self.assertEqual(row["allocation_id"], self.allocation.pk)
        self.assertEqual(row["status"], "Chưa nộp")
        self.assertEqual(row["late_reason"], "")
        self.assertEqual(row["change_reason"], "")
        self.assertFalse(row["can_update_exception"])
        Allocation.objects.filter(pk=self.allocation.pk).update(deadline=timezone.now()-timedelta(hours=1))
        self.assertEqual(self.get_progress(self.teacher)["rows"][0]["status"], "Quá hạn")

    def test_existing_exception_endpoint_updates_reason_and_keeps_permissions(self):
        Allocation.objects.filter(pk=self.allocation.pk).update(deadline=timezone.now()-timedelta(hours=1))
        submission = Submission.objects.create(allocation=self.allocation, enrollment=self.member,
            content="Bài làm", submitted_at=timezone.now())
        row = self.get_progress(self.teacher)["rows"][0]
        self.assertEqual(row["status"], "Nộp muộn")
        self.assertTrue(row["can_update_exception"])
        response = self.client.post("/api/exceptions/", json.dumps({"submission":submission.pk,
            "reason":"File nộp không đúng đề bài", "next_status":"invalid"}), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        row = self.get_progress(self.teacher)["rows"][0]
        self.assertEqual(row["status"], "Không hợp lệ")
        self.assertEqual(row["change_reason"], "File nộp không đúng đề bài")
        self.assertEqual(row["late_reason"], "")
        self.assertFalse(self.get_progress(self.manager)["rows"][0]["can_update_exception"])
        response = self.client.post("/api/exceptions/", json.dumps({"submission":submission.pk,
            "reason":"Không có quyền", "next_status":"valid"}), content_type="application/json")
        self.assertEqual(response.status_code, 403)

    def test_multiple_assignments_in_one_session_have_distinct_options(self):
        assignment = Assignment.objects.create(title="Reading", teacher=self.teacher)
        second = Allocation.objects.create(assignment=assignment, classroom=self.classroom,
            session=self.allocation.session, deadline=timezone.now()+timedelta(days=2))
        response = self.get_progress(self.teacher)
        self.assertEqual(len(response["rows"]), 2)
        self.assertEqual({a["id"] for a in response["allocations"]}, {self.allocation.pk, second.pk})
        self.assertEqual({r["student_id"] for r in response["rows"]}, {self.student.pk})

    def test_empty_managed_class_is_available_for_empty_state(self):
        classroom = Classroom.objects.create(course=self.course, teacher=self.teacher,
            manager=self.manager, start_date=self.classroom.start_date, end_date=self.classroom.end_date)
        response = self.get_progress(self.manager)
        self.assertIn(classroom.pk, [c["id"] for c in response["classes"]])
        self.assertFalse(any(r["classroom_id"] == classroom.pk for r in response["rows"]))

    def test_draft_submission_cannot_receive_exception(self):
        Submission.objects.create(allocation=self.allocation, enrollment=self.member, content="Bản nháp")
        row = self.get_progress(self.teacher)["rows"][0]
        self.assertEqual(row["status"], "Chưa nộp")
        self.assertFalse(row["can_update_exception"])
