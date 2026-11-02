import shutil
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from . import tests as legacy_tests
from .models import Attachment, Audit, Classroom, Enrollment, Submission, SubmissionUpdate


class SubmissionUpdateTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        legacy_tests.WorkflowTests.setUpTestData.__func__(cls)

    def setUp(self):
        root = Path(tempfile.mkdtemp(prefix="submission-update-test-"))
        self.root = root
        self.addCleanup(lambda: shutil.rmtree(root, ignore_errors=True))
        settings = override_settings(MEDIA_ROOT=root / "uploads")
        settings.enable()
        self.addCleanup(settings.disable)
        storage = patch.object(SubmissionUpdate._meta.get_field("evidence"), "storage",
            FileSystemStorage(location=root / "private-evidence"))
        storage.start()
        self.addCleanup(storage.stop)
        self.client.force_login(self.teacher)
        self.url = f"/api/progress/{self.allocation.pk}/{self.member.pk}/update/"
        self.allocation.deadline = timezone.now() - timedelta(hours=2)
        self.allocation.save(update_fields=["deadline"])

    def pdf(self, name="bai-lam.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4\nTest work", content_type="application/pdf")

    def test_get_authoritative_information_for_selected_student(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["student_code"], self.student.username)
        self.assertEqual(response.json()["classroom"], self.classroom.code)
        self.assertEqual(response.json()["status"], "Quá hạn")
        self.assertEqual(response.json()["files"], [])

    def test_reason_only_records_history_without_creating_submission(self):
        response = self.client.post(self.url, {"reason": "Học viên đang bị ốm"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "Quá hạn")
        self.assertFalse(Submission.objects.exists())
        record = SubmissionUpdate.objects.get()
        self.assertEqual(record.author, self.teacher)
        self.assertEqual(record.previous_status, "Quá hạn")
        self.assertEqual(record.next_status, "Quá hạn")
        self.assertIsNone(record.work_attachment)
        row = self.client.get("/api/progress/").json()["rows"][0]
        self.assertEqual(row["change_reason"], record.reason)
        self.assertEqual(row["enrollment_id"], self.member.pk)
        self.assertTrue(row["can_update_submission"])

    def test_evidence_is_private_and_does_not_count_as_student_work(self):
        response = self.client.post(self.url, {"reason": "Có giấy xác nhận", "evidence": self.pdf("giay-xac-nhan.pdf")})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(Submission.objects.exists())
        self.assertFalse(Attachment.objects.exists())
        record = SubmissionUpdate.objects.get()
        self.assertTrue(record.evidence.storage.exists(record.evidence.name))
        self.assertNotIn("uploads", record.evidence.path)
        url = f"/api/progress/updates/{record.pk}/evidence/"
        row = self.client.get("/api/progress/").json()["rows"][0]
        self.assertEqual(row["evidence_url"], url)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF-"))
        response.close()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_uploaded_work_creates_real_late_submission_visible_to_student(self):
        response = self.client.post(self.url, {"reason": "Nhận bài qua Zalo sau hạn", "work_file": self.pdf()})
        self.assertEqual(response.status_code, 200, response.content)
        sub = Submission.objects.get()
        record = SubmissionUpdate.objects.get()
        self.assertEqual(sub.status, "Nộp muộn")
        self.assertEqual(record.work_attachment.submission, sub)
        self.assertEqual(record.previous_status, "Quá hạn")
        self.assertEqual(record.next_status, "Nộp muộn")
        self.assertTrue(Audit.objects.filter(action="update_submission", actor=self.teacher).exists())
        self.client.force_login(self.student)
        detail = self.client.get(f"/api/homework/{self.allocation.pk}/").json()
        self.assertEqual(detail["submission"]["files"][0]["name"], "bai-lam.pdf")
        self.assertEqual(detail["submission"]["status"], "Nộp muộn")

    def test_reason_only_preserves_original_submission_timestamp(self):
        stamp = self.allocation.deadline - timedelta(minutes=20)
        sub = Submission.objects.create(allocation=self.allocation, enrollment=self.member,
            content="Bài đã nộp", submitted_at=stamp)
        response = self.client.post(self.url, {"reason": "Bổ sung ghi chú"})
        self.assertEqual(response.status_code, 200)
        sub.refresh_from_db()
        self.assertEqual(sub.submitted_at, stamp)
        self.assertEqual(sub.status, "Đã nộp")

    def test_manual_file_does_not_block_normal_student_cancel_and_delete(self):
        self.allocation.deadline = timezone.now() + timedelta(days=1)
        self.allocation.save(update_fields=["deadline"])
        response = self.client.post(self.url, {"reason": "Nhận bài trước hạn", "work_file": self.pdf()})
        self.assertEqual(response.status_code, 200)
        record = SubmissionUpdate.objects.get()
        attachment_id = record.work_attachment_id
        self.client.force_login(self.student)
        base = f"/api/homework/{self.allocation.pk}/"
        self.assertEqual(self.client.delete(base + "submit/").status_code, 200)
        self.assertEqual(self.client.delete(base + f"files/{attachment_id}/").status_code, 200)
        record.refresh_from_db()
        self.assertIsNone(record.work_attachment_id)
        self.assertEqual(record.work_name, "bai-lam.pdf")

    def test_uploaded_work_does_not_silently_reverse_invalid_decision(self):
        sub = Submission.objects.create(allocation=self.allocation, enrollment=self.member,
            content="Bài cũ", submitted_at=timezone.now(), invalid=True)
        response = self.client.post(self.url, {"reason": "Bổ sung file", "work_file": self.pdf()})
        self.assertEqual(response.status_code, 200)
        sub.refresh_from_db()
        self.assertTrue(sub.invalid)
        self.assertEqual(response.json()["status"], "Không hợp lệ")

    def test_invalid_file_does_not_leave_partial_update(self):
        response = self.client.post(self.url, {"reason": "Có tài liệu", "work_file": self.pdf(),
            "evidence": SimpleUploadedFile("fake.pdf", b"not-a-pdf")})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SubmissionUpdate.objects.exists())
        self.assertFalse(Submission.objects.exists())
        self.assertFalse(Attachment.objects.exists())

    def test_reason_and_file_limits(self):
        for reason in ["", "  ", "x" * 501]:
            self.assertEqual(self.client.post(self.url, {"reason": reason}).status_code, 400)
        self.assertEqual(self.client.post(self.url, {"reason": "Hai file",
            "work_file": [self.pdf("one.pdf"), self.pdf("two.pdf")]}).status_code, 400)
        oversized = SimpleUploadedFile("large.pdf", b"%PDF-" + b"x" * (20 * 1024 * 1024))
        self.assertEqual(self.client.post(self.url, {"reason": "File quá lớn", "evidence": oversized}).status_code, 400)
        self.assertFalse(SubmissionUpdate.objects.exists())

    def test_permissions_and_wrong_class_are_enforced_on_server(self):
        for user in [self.manager, self.student]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.client.post(self.url, {"reason": "Không có quyền"}).status_code, 403)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_login(self.teacher)
        classroom = Classroom.objects.create(course=self.course, manager=self.manager, teacher=self.teacher,
            start_date=self.classroom.start_date, end_date=self.classroom.end_date)
        member = Enrollment.objects.create(classroom=classroom, student=self.stranger)
        url = f"/api/progress/{self.allocation.pk}/{member.pk}/update/"
        self.assertEqual(self.client.post(url, {"reason": "Sai lớp"}).status_code, 404)
        self.assertFalse(SubmissionUpdate.objects.exists())

    def test_inactive_membership_blocks_updates(self):
        self.member.left_at = timezone.now()
        self.member.save(update_fields=["left_at"])
        self.assertEqual(self.client.post(self.url, {"reason": "Đã rời lớp"}).status_code, 400)

    def test_transaction_failure_cleans_both_uploaded_files(self):
        with patch.object(SubmissionUpdate, "save", side_effect=RuntimeError("Simulated database failure")):
            with self.assertRaises(RuntimeError):
                self.client.post(self.url, {"reason": "Thử rollback", "evidence": self.pdf("proof.pdf"), "work_file": self.pdf()})
        self.assertFalse(Submission.objects.exists())
        self.assertFalse(Attachment.objects.exists())
        self.assertFalse(SubmissionUpdate.objects.exists())
        self.assertFalse(any(p.is_file() for p in self.root.rglob("*")))
