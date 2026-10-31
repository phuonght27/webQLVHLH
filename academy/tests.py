from datetime import timedelta, time
from decimal import Decimal
from django.test import TestCase, Client, override_settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core import mail
from .models import *
from .services import sync_schedule
import json, re


class WorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def user(name, role):
            u = Account(
                email=name + "@example.com",
                full_name="Nguyễn Minh Anh",
                phone="0901234567",
                gender="Nam",
                address="Hà Nội",
                role=role,
                must_change_password=False,
            )
            u.set_password("SecureExample!234")
            u.save()
            return u

        cls.admin = user("admin", "QLCN")
        cls.manager = user("manager", "QLLH")
        cls.teacher = user("teacher", "GV")
        cls.other = user("other", "GV")
        cls.student = user("student", "HV")
        cls.stranger = user("stranger", "HV")
        cls.course = Course.objects.create(
            name="Basic", symbol="BASIC", description="Foundation"
        )
        cls.classroom = Classroom.objects.create(
            course=cls.course,
            manager=cls.manager,
            teacher=cls.teacher,
            start_date=timezone.localdate() - timedelta(days=7),
            end_date=timezone.localdate() + timedelta(days=30),
        )
        cls.member = Enrollment.objects.create(
            classroom=cls.classroom, student=cls.student
        )
        cls.shift = Shift.objects.create(name="Ca 1", start=time(18), end=time(20))
        cls.room = Room.objects.create(name="201")
        cls.schedule = Schedule.objects.create(
            classroom=cls.classroom, shift=cls.shift, room=cls.room
        )
        sync_schedule(cls.schedule, list(range(2, 9)))
        cls.assignment = Assignment.objects.create(
            title="Listening", teacher=cls.teacher
        )
        cls.allocation = Allocation.objects.create(
            assignment=cls.assignment,
            classroom=cls.classroom,
            session=Session.objects.filter(classroom=cls.classroom).first(),
            deadline=timezone.now() + timedelta(days=3),
        )
        cls.exam = ExamType.objects.create(name="Đầu vào")

    def login(self, u):
        self.client.force_login(u)

    def post(self, url, d, method="post"):
        return getattr(self.client, method)(
            url, data=json.dumps(d), content_type="application/json"
        )

    def grade(self, **kw):
        d = {
            "enrollment": self.member.pk,
            "exam_type": self.exam.pk,
            "listening": "6.5",
            "reading": "7",
            "speaking": "6",
            "writing": "6",
            "exam_date": str(timezone.localdate()),
        }
        d.update(kw)
        return d

    def test_unauthenticated_denied(self):
        self.assertEqual(self.client.get("/api/classes/").status_code, 401)

    def test_first_password_change_enforced(self):
        self.student.must_change_password = True
        self.student.save()
        self.login(self.student)
        self.assertEqual(self.client.get("/api/classes/").status_code, 403)

    def test_login_inactive_denied(self):
        self.student.is_active = False
        self.student.save()
        self.assertEqual(
            self.post(
                "/api/auth/login/",
                {"email": self.student.email, "password": "SecureExample!234"},
            ).status_code,
            400,
        )

    def test_login_and_logout(self):
        self.assertEqual(
            self.post(
                "/api/auth/login/",
                {"email": self.student.email, "password": "SecureExample!234"},
            ).status_code,
            200,
        )
        self.assertEqual(LoginSession.objects.count(), 1)
        self.post("/api/auth/logout/", {})
        self.assertIsNotNone(LoginSession.objects.first().logged_out)

    def test_student_scope(self):
        self.login(self.stranger)
        self.assertEqual(self.client.get("/api/classes/").json()["total"], 0)
        self.assertEqual(
            self.client.get(f"/api/allocations/{self.allocation.pk}/").status_code, 404
        )

    def test_teacher_scope(self):
        self.login(self.other)
        self.assertEqual(self.client.get("/api/classes/").json()["total"], 0)
        self.assertEqual(self.client.get("/api/grades/").json()["total"], 0)

    def test_student_cannot_create_course(self):
        self.login(self.student)
        self.assertEqual(self.post("/api/courses/", {"name": "X"}).status_code, 403)

    def test_all_form_metadata(self):
        for u, kinds in [
            (
                self.admin,
                [
                    "accounts",
                    "courses",
                    "shifts",
                    "classes",
                    "enrollments",
                    "schedules",
                ],
            ),
            (
                self.teacher,
                ["assignments", "allocations", "comments", "exceptions", "grades"],
            ),
            (self.student, ["submissions", "retakes"]),
        ]:
            self.login(u)
            for k in kinds:
                with self.subTest(kind=k):
                    self.assertEqual(
                        self.client.get("/api/" + k + "/?form=1").status_code, 200
                    )

    def test_all_lists(self):
        self.login(self.admin)
        for k in [
            "accounts",
            "courses",
            "shifts",
            "classes",
            "enrollments",
            "schedules",
            "assignments",
            "allocations",
            "submissions",
            "comments",
            "exceptions",
            "grades",
            "retakes",
        ]:
            with self.subTest(kind=k):
                self.assertEqual(self.client.get("/api/" + k + "/").status_code, 200)

    def test_create_and_edit_course(self):
        self.login(self.admin)
        response = self.post(
            "/api/courses/", {"name": "Ready", "symbol": "READY", "description": "Test"}
        )
        self.assertEqual(response.status_code, 200, response.content)
        id = response.json()["id"]
        self.post(f"/api/courses/{id}/", {"description": "Updated"}, "patch")
        self.assertEqual(Course.objects.get(pk=id).description, "Updated")

    def test_archive_restore(self):
        self.login(self.admin)
        self.post(f"/api/courses/{self.course.pk}/", {"_action": "archive"}, "patch")
        self.assertEqual(self.client.get("/api/courses/").json()["total"], 0)
        self.assertEqual(self.client.get("/api/courses/?archived=1").json()["total"], 1)
        self.post(f"/api/courses/{self.course.pk}/", {"_action": "restore"}, "patch")
        self.assertEqual(self.client.get("/api/courses/").json()["total"], 1)

    def test_delete_used_course_blocked(self):
        self.login(self.admin)
        self.assertEqual(
            self.client.delete(f"/api/courses/{self.course.pk}/").status_code, 400
        )

    def test_grade_validation(self):
        self.login(self.teacher)
        self.assertEqual(
            self.post("/api/grades/", self.grade(listening="10.5")).status_code, 400
        )
        self.assertEqual(Grade.objects.count(), 0)

    def test_grade_rounding_and_history(self):
        self.login(self.teacher)
        r = self.post("/api/grades/", self.grade())
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Grade.objects.first().overall, Decimal("6.5"))
        self.assertEqual(GradeHistory.objects.count(), 1)

    def test_grade_bulk_atomic(self):
        self.login(self.teacher)
        r = self.post(
            "/api/bulk/grades/", {"rows": [self.grade(), self.grade(listening="11")]}
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Grade.objects.count(), 0)

    def test_account_role_escalation_denied(self):
        self.login(self.manager)
        d = {
            "email": "new@example.com",
            "full_name": "Trần Minh Anh",
            "gender": "Nữ",
            "phone": "0901234567",
            "address": "Hà Nội",
            "role": "QLCN",
        }
        self.assertEqual(self.post("/api/accounts/", d).status_code, 400)

    def test_account_creation_hashed_and_first_login(self):
        self.login(self.manager)
        d = {
            "email": "new@example.com",
            "full_name": "Trần Minh Anh",
            "gender": "Nữ",
            "phone": "0901234567",
            "address": "Hà Nội",
            "role": "HV",
        }
        r = self.post("/api/accounts/", d)
        self.assertEqual(r.status_code, 200, r.content)
        u = Account.objects.get(email=d["email"])
        self.assertTrue(u.check_password(r.json()["temporary_password"]))
        self.assertTrue(u.must_change_password)
        self.assertNotIn(
            "password",
            self.client.get("/api/accounts/")
            .content.decode()
            .replace("must_change_password", ""),
        )

    def test_submission_and_cancel(self):
        self.login(self.student)
        r = self.post(
            "/api/submissions/",
            {
                "allocation": self.allocation.pk,
                "enrollment": self.member.pk,
                "content": "Bài làm",
            },
        )
        self.assertEqual(r.status_code, 200, r.content)
        sub = Submission.objects.get(pk=r.json()["id"])
        self.assertEqual(sub.status, "Đã nộp")
        self.assertEqual(
            self.client.delete(f"/api/submissions/{sub.pk}/").status_code, 200
        )
        sub.refresh_from_db()
        self.assertIsNone(sub.submitted_at)

    def test_submission_cannot_impersonate(self):
        self.login(self.stranger)
        r = self.post(
            "/api/submissions/",
            {
                "allocation": self.allocation.pk,
                "enrollment": self.member.pk,
                "content": "Spoof",
            },
        )
        self.assertEqual(r.status_code, 400)

    def test_late_submission_cannot_cancel(self):
        self.allocation.deadline = timezone.now() - timedelta(days=1)
        self.allocation.save()
        sub = Submission.objects.create(
            allocation=self.allocation,
            enrollment=self.member,
            content="Late",
            submitted_at=timezone.now(),
        )
        self.login(self.student)
        self.assertEqual(
            self.client.delete(f"/api/submissions/{sub.pk}/").status_code, 400
        )

    def test_schedule_preserves_referenced_sessions(self):
        sid = self.allocation.session_id
        sync_schedule(self.schedule, [2, 4, 6])
        self.assertTrue(Session.objects.filter(pk=sid).exists())

    def test_schedule_conflict(self):
        c = Classroom.objects.create(
            course=self.course,
            manager=self.manager,
            teacher=self.other,
            start_date=self.classroom.start_date,
            end_date=self.classroom.end_date,
        )
        s = Schedule.objects.create(classroom=c, shift=self.shift, room=self.room)
        with self.assertRaises(ValidationError):
            sync_schedule(s, [2, 4, 6])

    def test_csrf_enforced(self):
        c = Client(enforce_csrf_checks=True)
        self.assertEqual(
            c.post("/api/auth/login/", {"email": self.student.email}).status_code, 403
        )

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_otp_reset_and_replay(self):
        self.post("/api/auth/forgot/", {"email": self.student.email})
        code = re.search(r"\b\d{6}\b", mail.outbox[0].body).group()
        payload = {
            "email": self.student.email,
            "code": code,
            "password": "AnotherSecure!234",
        }
        self.assertEqual(self.post("/api/auth/reset/", payload).status_code, 200)
        self.assertEqual(self.post("/api/auth/reset/", payload).status_code, 400)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password(payload["password"]))

    def test_retake_review_and_snapshot(self):
        obj = RetakeRequest.objects.create(
            enrollment=self.member, reason="Muốn củng cố kiến thức"
        )
        RetakeCriterion.objects.create(
            name="Cơ bản", min_score=5, min_submission_rate=80
        )
        self.login(self.manager)
        r = self.post(
            f"/api/retakes/{obj.pk}/review/",
            {"status": "approved", "note": "Đã trao đổi với học viên"},
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(RetakeEvaluation.objects.count(), 1)
        self.assertEqual(
            self.post(
                f"/api/retakes/{obj.pk}/review/",
                {"status": "approved", "note": "Repeat"},
            ).status_code,
            400,
        )

    def test_dashboard(self):
        self.login(self.student)
        r = self.client.get("/api/overview/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["classes"], 1)

    def test_progress_includes_missing_submission_and_scope(self):
        self.login(self.student)
        rows = self.client.get("/api/progress/").json()["rows"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "Chưa nộp")
        self.login(self.stranger)
        self.assertEqual(self.client.get("/api/progress/").json()["rows"], [])

    def test_status_and_foreign_key_filter_server_side(self):
        self.login(self.admin)
        self.assertEqual(
            self.client.get(
                "/api/classes/?filter_course=" + str(self.course.pk)
            ).json()["total"],
            1,
        )
        self.assertEqual(
            self.client.get("/api/classes/?status=Đã kết thúc").json()["total"], 0
        )
        self.assertEqual(self.client.get("/api/classes/?q=basic").json()["total"], 1)

    def test_archived_parent_blocks_submission(self):
        self.classroom.archived_at = timezone.now()
        self.classroom.save()
        self.login(self.student)
        r = self.post(
            "/api/submissions/",
            {
                "allocation": self.allocation.pk,
                "enrollment": self.member.pk,
                "content": "Bài làm",
            },
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Submission.objects.count(), 0)

    def test_grade_soft_delete_can_reenter(self):
        self.login(self.teacher)
        r = self.post("/api/grades/", self.grade())
        pk = r.json()["id"]
        self.assertEqual(self.client.delete(f"/api/grades/{pk}/").status_code, 200)
        self.assertEqual(self.post("/api/grades/", self.grade()).status_code, 200)
        self.assertEqual(GradeHistory.objects.count(), 2)

    def test_fractional_score_step(self):
        self.login(self.teacher)
        self.assertEqual(
            self.post("/api/grades/", self.grade(reading="6.2")).status_code, 400
        )

    def test_account_bulk_rollback(self):
        self.login(self.manager)
        d = {
            "email": "valid@example.com",
            "full_name": "Trần Minh Anh",
            "gender": "Nữ",
            "phone": "0901234567",
            "address": "Hà Nội",
            "role": "HV",
        }
        count = Account.objects.count()
        self.assertEqual(
            self.post(
                "/api/bulk/accounts/", {"rows": [d, {**d, "email": "bad"}]}
            ).status_code,
            400,
        )
        self.assertEqual(Account.objects.count(), count)

    def test_upload_and_download_permissions(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        import tempfile

        with tempfile.TemporaryDirectory() as tmp, self.settings(MEDIA_ROOT=tmp):
            self.login(self.teacher)
            url = f"/api/assignments/{self.assignment.pk}/upload/"
            bad = SimpleUploadedFile(
                "fake.pdf", b"<script>bad</script>", content_type="application/pdf"
            )
            self.assertEqual(self.client.post(url, {"file": bad}).status_code, 400)
            good = SimpleUploadedFile(
                "lesson.pdf",
                b"%PDF-1.4\nexample\n%%EOF",
                content_type="application/pdf",
            )
            response = self.client.post(url, {"file": good})
            self.assertEqual(response.status_code, 200)
            file_id = response.json()["id"]
            self.login(self.stranger)
            self.assertEqual(self.client.get(f"/api/files/{file_id}/").status_code, 403)
            self.login(self.student)
            response = self.client.get(f"/api/files/{file_id}/")
            self.assertEqual(response.status_code, 200)
            response.close()

    def test_account_cannot_be_deleted(self):
        self.login(self.admin)
        self.assertEqual(
            self.client.delete(f"/api/accounts/{self.teacher.pk}/").status_code, 403
        )

    def test_left_student_can_read_but_cannot_submit(self):
        self.member.left_at = timezone.now()
        self.member.save()
        self.login(self.student)
        self.assertEqual(self.client.get("/api/classes/").json()["total"], 1)
        response = self.post(
            "/api/submissions/",
            {
                "allocation": self.allocation.pk,
                "enrollment": self.member.pk,
                "content": "Bài làm",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_schedule_api_conflict_rolls_back(self):
        c = Classroom.objects.create(
            course=self.course,
            manager=self.manager,
            teacher=self.other,
            start_date=self.classroom.start_date,
            end_date=self.classroom.end_date,
        )
        count = Schedule.objects.count()
        self.login(self.manager)
        response = self.post(
            "/api/schedules/",
            {
                "classroom": c.pk,
                "shift": self.shift.pk,
                "room": self.room.pk,
                "days": ["2", "4"],
            },
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Schedule.objects.count(), count)

    def test_class_detail_includes_members_and_sessions(self):
        self.login(self.student)
        d = self.client.get(f"/api/classes/{self.classroom.pk}/").json()
        self.assertEqual(len(d["members"]), 1)
        self.assertGreater(len(d["sessions"]), 0)

    def test_bulk_allocation_multi_class_and_rollback(self):
        c = Classroom.objects.create(
            course=self.course,
            manager=self.manager,
            teacher=self.teacher,
            start_date=self.classroom.start_date,
            end_date=self.classroom.end_date,
        )
        room = Room.objects.create(name="202")
        s = Schedule.objects.create(classroom=c, shift=self.shift, room=room)
        session = Session.objects.create(
            schedule=s,
            classroom=c,
            number=1,
            date=timezone.localdate(),
            shift=self.shift,
            room=room,
        )
        self.login(self.teacher)
        row = {
            "assignment": self.assignment.pk,
            "classroom": c.pk,
            "session": session.pk,
            "deadline": (timezone.now() + timedelta(days=3)).isoformat(),
        }
        self.assertEqual(
            self.post(
                "/api/bulk/allocations/", {"rows": [row, {**row, "session": 99999}]}
            ).status_code,
            400,
        )
        self.assertEqual(Allocation.objects.filter(classroom=c).count(), 0)
        self.assertEqual(
            self.post("/api/bulk/allocations/", {"rows": [row]}).status_code, 200
        )
        self.assertEqual(
            Allocation.objects.filter(assignment=self.assignment).count(), 2
        )

    def test_allocation_schema_has_classroom_ids(self):
        self.login(self.teacher)
        fields = self.client.get("/api/allocations/?form=1").json()["fields"]
        sessions = next(f for f in fields if f["name"] == "session")["choices"]
        self.assertTrue(
            any(s.get("classroom_id") == self.classroom.pk for s in sessions)
        )

    def test_schedule_delete_without_assignment_cancels_future(self):
        room = Room.objects.create(name="203")
        s = Schedule.objects.create(
            classroom=self.classroom, shift=self.shift, room=room
        )
        session = Session.objects.create(
            schedule=s,
            classroom=self.classroom,
            date=timezone.localdate() + timedelta(days=40),
            number=100,
            shift=self.shift,
            room=room,
        )
        self.login(self.manager)
        self.assertEqual(self.client.delete(f"/api/schedules/{s.pk}/").status_code, 200)
        session.refresh_from_db()
        self.assertTrue(session.cancelled)
