import json
from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from . import tests as legacy_tests
from .models import Account, Allocation, Assignment, Classroom, Counter, Course, Enrollment, Room, Schedule, Session, Shift, Submission


class ClassManagementTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        legacy_tests.WorkflowTests.setUpTestData.__func__(cls)

    def setUp(self):
        self.client.force_login(self.manager)

    def send(self, kind, payload, pk=None, method=None, legacy=False):
        url = f"/api/{'' if legacy else 'class-management/'}{kind}/" + (f"{pk}/" if pk else "")
        return getattr(self.client, method or ("patch" if pk else "post"))(
            url, json.dumps(payload), content_type="application/json")

    def class_payload(self):
        start = timezone.localdate() + timedelta(days=40)
        return {"course": self.course.pk, "teacher": self.teacher.pk,
            "start_date": str(start), "end_date": str(start + timedelta(days=20)),
            "students": [self.student.pk]}

    def new_class(self, teacher=None):
        start = timezone.localdate() + timedelta(days=3)
        return Classroom.objects.create(course=self.course, teacher=teacher or self.other, manager=self.manager,
            start_date=start, end_date=start + timedelta(days=16))

    def schedule_payload(self, classroom):
        shift = Shift.objects.create(name="Ca sáng", start=time(7), end=time(9))
        return {"classroom": classroom.pk, "shift": shift.pk, "room": self.room.pk, "days": [2, 4]}

    def test_manager_catalogues_are_read_only_in_both_routes(self):
        for kind, payload in [("courses", {"name": "Test", "description": "Test"}),
                ("shifts", {"name": "Ca sáng", "start": "07:00", "end": "09:00"})]:
            self.assertEqual(self.client.get(f"/api/class-management/{kind}/").status_code, 200)
            self.assertEqual(self.send(kind, payload).status_code, 403)
            self.assertEqual(self.send(kind, payload, legacy=True).status_code, 403)
        self.assertEqual(self.client.get("/api/courses/?form=1").status_code, 403)

    def test_options_scope_students_and_assign_current_manager(self):
        response = self.client.get("/api/class-management/options/").json()
        self.assertEqual(response["manager"]["id"], self.manager.pk)
        self.assertEqual({s["id"] for s in response["students"]}, {self.student.pk})
        self.assertNotIn(self.stranger.pk, {s["id"] for s in response["students"]})
        self.assertTrue(all(c["manager"] == self.manager.pk for c in response["classes"]))

    def test_atomic_class_creation_assigns_code_manager_and_members(self):
        response = self.send("classes", {**self.class_payload(), "code": "FORGED"})
        self.assertEqual(response.status_code, 200, response.content)
        classroom = Classroom.objects.get(pk=response.json()["id"])
        self.assertEqual(classroom.manager, self.manager)
        self.assertTrue(classroom.code.startswith(self.course.symbol))
        self.assertNotEqual(classroom.code, "FORGED")
        self.assertEqual(Enrollment.objects.filter(classroom=classroom).count(), 1)
        detail = self.client.get(f"/api/class-management/classes/{classroom.pk}/").json()
        self.assertEqual(detail["student_count"], 1)
        self.assertEqual(detail["members"][0]["code"], self.student.username)

    def test_bad_students_roll_back_class_and_counter(self):
        old_count = Classroom.objects.count()
        old_counter = Counter.objects.get(prefix=self.course.symbol).value
        for students in [[self.stranger.pk], [self.student.pk, self.student.pk]]:
            response = self.send("classes", {**self.class_payload(), "students": students})
            self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Classroom.objects.count(), old_count)
        self.assertEqual(Counter.objects.get(prefix=self.course.symbol).value, old_counter)

    def test_existing_imported_class_codes_are_not_reused(self):
        Classroom.objects.create(course=self.course, manager=self.manager, teacher=self.teacher,
            code=f"{self.course.symbol}500", start_date=self.classroom.start_date, end_date=self.classroom.end_date)
        response = self.send("classes", self.class_payload())
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Classroom.objects.get(pk=response.json()["id"]).code, f"{self.course.symbol}501")

    def test_class_number_sequence_is_independent_per_course(self):
        course = Course.objects.create(name="Basic 2", symbol=self.course.symbol+"2", description="Khóa khác")
        Classroom.objects.create(course=course, manager=self.manager, teacher=self.teacher,
            start_date=self.classroom.start_date, end_date=self.classroom.end_date)
        response = self.send("classes", self.class_payload())
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Classroom.objects.get(pk=response.json()["id"]).code, f"{self.course.symbol}002")

    def test_manager_identity_and_course_are_immutable_even_via_legacy(self):
        response = self.send("classes", {**self.class_payload(), "manager": self.admin.pk}, legacy=True)
        self.assertEqual(response.status_code, 400)
        other_course = Course.objects.create(name="Ready", symbol="READY", description="Ready")
        response = self.send("classes", {"course": other_course.pk}, self.classroom.pk, legacy=True)
        self.assertEqual(response.status_code, 400)
        response = self.send("classes", {"manager": self.admin.pk}, self.classroom.pk, legacy=True)
        self.assertEqual(response.status_code, 400)
        self.classroom.refresh_from_db()
        self.assertEqual(self.classroom.manager, self.manager)

    def test_other_manager_class_not_accessible(self):
        manager = Account.objects.create(email="other-qllh@example.com", role="QLLH", full_name="Quản Lý Khác",
            gender="Nam", phone="0901234567", address="Hà Nội", must_change_password=False)
        classroom = self.new_class()
        classroom.manager = manager
        classroom.save()
        self.assertEqual(self.client.get(f"/api/class-management/classes/{classroom.pk}/").status_code, 404)
        self.assertEqual(self.send("classes", {"teacher": self.teacher.pk}, classroom.pk).status_code, 404)
        self.assertNotIn(classroom.pk, [c["id"] for c in self.client.get("/api/class-management/classes/").json()["rows"]])

    def test_remove_and_rejoin_preserve_student_work_and_membership_identity(self):
        sub = Submission.objects.create(allocation=self.allocation, enrollment=self.member, content="Bài làm", submitted_at=timezone.now())
        url = f"/api/class-management/enrollments/{self.member.pk}/"
        self.assertEqual(self.client.delete(url).status_code, 200)
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.left_at)
        self.assertTrue(Submission.objects.filter(pk=sub.pk).exists())
        response = self.send("enrollments", {"classroom": self.classroom.pk, "students": [self.student.pk]})
        self.assertEqual(response.status_code, 200, response.content)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.left_at)
        self.assertEqual(Enrollment.objects.filter(classroom=self.classroom, student=self.student).count(), 1)

    def test_ended_class_cannot_be_edited(self):
        Classroom.objects.filter(pk=self.classroom.pk).update(end_date=timezone.localdate()-timedelta(days=1))
        self.assertEqual(self.send("classes", {"teacher": self.other.pk}, self.classroom.pk).status_code, 400)

    def test_schedule_creates_real_dated_sessions_within_class_range(self):
        classroom = self.new_class()
        payload = self.schedule_payload(classroom)
        response = self.send("schedules", payload)
        self.assertEqual(response.status_code, 200, response.content)
        schedule = Schedule.objects.get(pk=response.json()["id"])
        sessions = list(Session.objects.filter(schedule=schedule).order_by("date"))
        self.assertTrue(sessions)
        self.assertEqual([s.number for s in sessions], list(range(1, len(sessions)+1)))
        self.assertTrue(all(classroom.start_date <= s.date <= classroom.end_date and s.date.weekday()+2 in [2,4] for s in sessions))
        rows = self.client.get("/api/class-management/schedules/").json()["rows"]
        selected = [r for r in rows if r["schedule_id"] == schedule.pk]
        self.assertEqual(len(selected), len(sessions))
        self.assertTrue(all(r["room"] == self.room.name and r["course"] == self.course.name for r in selected))

    def test_duplicate_room_or_teacher_schedule_is_rejected_atomically(self):
        classroom = self.new_class()
        payload = self.schedule_payload(classroom)
        self.assertEqual(self.send("schedules", payload).status_code, 200)
        other_class = self.new_class(self.teacher)
        before = (Schedule.objects.count(), Session.objects.count())
        response = self.send("schedules", {**payload, "classroom": other_class.pk})
        self.assertEqual(response.status_code, 400)
        self.assertEqual((Schedule.objects.count(), Session.objects.count()), before)

    def test_room_edit_keeps_past_session_and_assignment_identity(self):
        room = Room.objects.create(name="P202")
        old = self.allocation.session
        self.assertLess(old.date, timezone.localdate())
        response = self.send("schedules", {"room": room.pk, "days": list(range(2,9))}, self.schedule.pk)
        self.assertEqual(response.status_code, 200, response.content)
        old.refresh_from_db()
        self.assertEqual(old.room, self.room)
        self.allocation.refresh_from_db()
        self.assertEqual(self.allocation.session_id, old.pk)
        self.assertTrue(Session.objects.filter(schedule=self.schedule, date__gt=timezone.localdate(), room=room).exists())

    def test_weekday_edit_keeps_future_session_numbers_chronological(self):
        classroom = self.new_class()
        payload = self.schedule_payload(classroom)
        response = self.send("schedules", {**payload, "days": [4]})
        self.assertEqual(response.status_code, 200)
        schedule_id = response.json()["id"]
        old_ids = set(Session.objects.filter(schedule_id=schedule_id).values_list("id", flat=True))
        response = self.send("schedules", {"room": self.room.pk, "days": [2,4,6]}, schedule_id)
        self.assertEqual(response.status_code, 200, response.content)
        sessions = list(Session.objects.filter(schedule_id=schedule_id, cancelled=False).order_by("date"))
        self.assertEqual([s.number for s in sessions], list(range(1, len(sessions)+1)))
        self.assertTrue(old_ids.issubset({s.pk for s in sessions}))

    def test_schedule_class_and_shift_cannot_change_via_legacy(self):
        new_class = self.new_class()
        response = self.send("schedules", {"classroom": new_class.pk, "room": self.room.pk, "days": [2]}, self.schedule.pk, legacy=True)
        self.assertEqual(response.status_code, 400)

    def test_class_date_edit_resyncs_future_sessions_without_deleting_past(self):
        old_id = self.allocation.session_id
        response = self.send("classes", {"end_date": str(timezone.localdate()+timedelta(days=3))}, self.classroom.pk)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Session.objects.filter(pk=old_id).exists())
        self.assertFalse(Session.objects.filter(classroom=self.classroom, date__gt=timezone.localdate()+timedelta(days=3), cancelled=False).exists())

    def test_teacher_change_rechecks_future_conflicts_and_rolls_back(self):
        room = Room.objects.create(name="Teacher-conflict-room")
        other_class = self.new_class(self.other)
        schedule = Schedule.objects.create(classroom=other_class, shift=self.shift, room=room)
        Session.objects.create(schedule=schedule, classroom=other_class, shift=self.shift, room=room,
            date=timezone.localdate()+timedelta(days=5), number=1)
        response = self.send("classes", {"teacher": self.other.pk}, self.classroom.pk)
        self.assertEqual(response.status_code, 400, response.content)
        self.classroom.refresh_from_db()
        self.assertEqual(self.classroom.teacher, self.teacher)

    def test_hide_restore_preserves_data_and_future_session_ids(self):
        future_ids = set(Session.objects.filter(classroom=self.classroom, date__gt=timezone.localdate()).values_list("pk", flat=True))
        self.assertEqual(self.send("classes", {"_action":"archive"}, self.classroom.pk).status_code, 200)
        self.assertFalse(Session.objects.filter(pk__in=future_ids, cancelled=False).exists())
        self.assertEqual(self.send("classes", {"_action":"restore"}, self.classroom.pk).status_code, 200)
        self.assertEqual(set(Session.objects.filter(pk__in=future_ids, cancelled=False).values_list("pk", flat=True)), future_ids)
        self.assertTrue(Allocation.objects.filter(pk=self.allocation.pk).exists())

    def test_qlcn_catalogue_create_edit_hide_restore_and_validation(self):
        self.client.force_login(self.admin)
        response = self.send("courses", {"name":"Pre IELTS", "description":"Khóa học nền tảng"})
        self.assertEqual(response.status_code, 200, response.content)
        course = Course.objects.get(pk=response.json()["id"])
        self.assertEqual(course.symbol, "PREIELTS")
        self.assertEqual(self.send("courses", {"name":"pre ielts", "description":"Trùng tên"}).status_code, 400)
        self.assertEqual(self.send("courses", {"description":"Nội dung mới"}, course.pk).status_code, 200)
        self.assertEqual(self.send("courses", {"name":"Tên khác"}, course.pk).status_code, 400)
        self.assertEqual(self.send("courses", {"_action":"archive"}, course.pk).status_code, 200)
        self.assertEqual(self.send("courses", {"_action":"restore"}, course.pk).status_code, 200)
        self.assertEqual(self.send("shifts", {"name":"Ca sớm", "start":"07:00", "end":"09:00"}).status_code, 200)
        self.assertEqual(self.send("shifts", {"name":"Ca trùng", "start":"08:00", "end":"10:00"}).status_code, 400)
        self.assertEqual(self.send("shifts", {"name":"Ca sai", "start":"12:00", "end":"11:00"}).status_code, 400)
        self.assertEqual(self.client.delete(f"/api/class-management/courses/{self.course.pk}/").status_code, 400)

    def test_other_roles_keep_their_original_class_management_route(self):
        for user in [self.teacher, self.student]:
            self.client.force_login(user)
            self.assertEqual(self.client.get("/api/class-management/options/").status_code, 403)
            self.assertEqual(self.client.get("/api/class-management/classes/").status_code, 403)
            self.assertEqual(self.client.get("/api/classes/").status_code, 200)

    def test_qllh_password_confirmation_and_existing_policy(self):
        old = "SecureExample!234"
        for payload in [{"old_password":old, "password":"NewSecure!928351", "confirm_password":"different"},
                {"old_password":old, "password":old, "confirm_password":old}]:
            response = self.client.post("/api/auth/password/", json.dumps(payload), content_type="application/json")
            self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/auth/password/", json.dumps({"old_password":old,
            "password":"NewSecure!928351", "confirm_password":"NewSecure!928351"}), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        self.manager.refresh_from_db()
        self.assertTrue(self.manager.check_password("NewSecure!928351"))
