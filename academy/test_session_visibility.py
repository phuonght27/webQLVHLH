import json

from django.test import TestCase
from django.utils import timezone

from . import tests as legacy_tests
from .models import Account, Allocation, Room, Schedule, Session


class SessionVisibilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        legacy_tests.WorkflowTests.setUpTestData.__func__(cls)

    def setUp(self):
        self.client.force_login(self.manager)

    def act(self, session, action):
        return self.client.patch(f"/api/class-management/sessions/{session.pk}/visibility/",
            json.dumps({"_action": action}), content_type="application/json")

    def ids(self, archived=False):
        response = self.client.get(f"/api/class-management/schedules/?archived={int(archived)}")
        self.assertEqual(response.status_code, 200)
        return {r["id"] for r in response.json()["rows"]}

    def test_hide_one_referenced_past_row_does_not_hide_siblings_or_cancel_work(self):
        target = self.allocation.session
        before = {s.pk: (s.cancelled, s.number) for s in Session.objects.filter(schedule=self.schedule)}
        response = self.act(target, "archive")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.ids(), set(before)-{target.pk})
        self.assertEqual(self.ids(True), {target.pk})
        self.assertEqual({s.pk: (s.cancelled, s.number) for s in Session.objects.filter(schedule=self.schedule)}, before)
        self.schedule.refresh_from_db()
        self.assertIsNone(self.schedule.archived_at)
        self.assertTrue(Allocation.objects.filter(pk=self.allocation.pk, session=target).exists())
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(f"/api/homework/{self.allocation.pk}/").status_code, 200)

    def test_restore_one_row_does_not_restore_other_hidden_rows(self):
        targets = list(Session.objects.filter(schedule=self.schedule).order_by("pk")[:2])
        for session in targets:
            self.assertEqual(self.act(session, "archive").status_code, 200)
        self.assertEqual(self.act(targets[0], "restore").status_code, 200)
        self.assertIn(targets[0].pk, self.ids())
        self.assertEqual(self.ids(True), {targets[1].pk})

    def test_archived_future_row_stays_hidden_after_schedule_edit(self):
        target = Session.objects.filter(schedule=self.schedule, date__gt=timezone.localdate()).first()
        self.assertEqual(self.act(target, "archive").status_code, 200)
        room = Room.objects.create(name="Visibility test room")
        response = self.client.patch(f"/api/class-management/schedules/{self.schedule.pk}/",
            json.dumps({"room": room.pk, "days": list(range(2,9))}), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        target.refresh_from_db()
        self.assertIsNotNone(target.archived_at)
        self.assertFalse(target.cancelled)
        self.assertEqual(self.ids(True), {target.pk})

    def test_restore_legacy_group_archive_only_shows_clicked_row(self):
        all_ids = self.ids()
        response = self.client.patch(f"/api/class-management/schedules/{self.schedule.pk}/",
            json.dumps({"_action":"archive"}), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(True), all_ids)
        target = self.allocation.session
        self.assertEqual(self.act(target, "restore").status_code, 200)
        self.assertEqual(self.ids(), {target.pk})
        self.assertEqual(self.ids(True), all_ids-{target.pk})
        self.schedule.refresh_from_db()
        self.assertIsNone(self.schedule.archived_at)
        self.assertTrue(Session.objects.filter(schedule=self.schedule, date__gt=timezone.localdate(), cancelled=False).exists())

    def test_other_roles_and_other_managers_cannot_hide_session(self):
        target = self.allocation.session
        for user in [self.teacher, self.student, self.admin]:
            self.client.force_login(user)
            self.assertEqual(self.act(target, "archive").status_code, 403)
        other = Account.objects.create(email="visibility-manager@example.com", role="QLLH", full_name="Quản Lý Khác",
            gender="Nam", phone="0901234567", address="Hà Nội", must_change_password=False)
        self.client.force_login(other)
        self.assertEqual(self.act(target, "archive").status_code, 404)
        target.refresh_from_db()
        self.assertIsNone(target.archived_at)

    def test_invalid_action_does_not_change_visibility(self):
        target = self.allocation.session
        self.assertEqual(self.act(target, "delete").status_code, 400)
        target.refresh_from_db()
        self.assertIsNone(target.archived_at)

    def test_row_restore_cannot_unarchive_its_class(self):
        self.classroom.archived_at = timezone.now()
        self.classroom.save(update_fields=["archived_at"])
        self.assertEqual(self.act(self.allocation.session, "restore").status_code, 400)
        self.classroom.refresh_from_db()
        self.assertIsNotNone(self.classroom.archived_at)
