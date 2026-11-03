import json
import shutil
import tempfile
from datetime import timedelta
from django.test import TestCase, override_settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from . import tests as fixtures
from .models import Assignment, Allocation, Attachment, Submission

class HomeworkRoleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        fixtures.WorkflowTests.setUpTestData.__func__(cls)
    def setUp(self):
        media=tempfile.mkdtemp(); override=override_settings(MEDIA_ROOT=media); override.enable()
        self.addCleanup(override.disable); self.addCleanup(lambda: shutil.rmtree(media,ignore_errors=True))
        self.client.force_login(self.teacher)
        self.url=f'/api/homework/assignments/{self.assignment.pk}/'
    def payload(self):
        return {'title':'Bài mới','description':'**Đọc đề**','deadlines':[{'id':self.allocation.pk,'deadline':(timezone.now()+timedelta(days=5)).isoformat()}],'remove_files':[]}
    def save(self,data=None,**extra):
        return self.client.post(self.url,{'payload':json.dumps(data or self.payload()),**extra})
    def pdf(self):
        return SimpleUploadedFile('de.pdf',b'%PDF-1.4\nfile',content_type='application/pdf')
    def test_edit_and_student_label_and_preview(self):
        response=self.save(files=[self.pdf()]); self.assertEqual(response.status_code,200,response.content)
        self.assignment.refresh_from_db(); self.allocation.refresh_from_db()
        self.assertTrue(self.assignment.edited); self.assertEqual(self.assignment.title,'Bài mới')
        self.assertGreater(self.allocation.deadline,timezone.now()+timedelta(days=4))
        file=Attachment.objects.get(assignment=self.assignment)
        self.client.force_login(self.student)
        row=self.client.get('/api/homework/').json()['rows'][0]
        self.assertTrue(row['edited']); self.assertTrue(row['can_submit'])
        self.assertEqual(self.client.get(self.url).status_code,403)
        response=self.client.get(f'/api/files/{file.pk}/preview/')
        self.assertEqual(response.status_code,200); self.assertEqual(response['Content-Type'],'application/pdf')
        self.assertEqual(response['X-Frame-Options'],'SAMEORIGIN'); response.close()
    def test_invalid_edits_atomic(self):
        original=self.assignment.title
        for mutate in [lambda d:d['deadlines'][0].update(deadline=(timezone.now()-timedelta(days=1)).isoformat()),lambda d:d['deadlines'][0].update(session=self.allocation.session_id),lambda d:d.update(remove_files=[999999]),lambda d:d.update(deadlines=[])]:
            data=self.payload(); mutate(data)
            self.assertEqual(self.save(data,files=[self.pdf()]).status_code,400)
            self.assignment.refresh_from_db(); self.assertEqual(self.assignment.title,original)
            self.assertFalse(Attachment.objects.filter(assignment=self.assignment).exists())
    def test_branch_even_superuser_read_only(self):
        self.admin.is_superuser=True; self.admin.save(); self.client.force_login(self.admin)
        self.assertEqual(self.client.get('/api/homework/').status_code,200)
        self.assertEqual(self.client.get('/api/progress/').status_code,200)
        self.assertEqual(self.save().status_code,403); self.assertEqual(self.client.delete(self.url).status_code,403)
        self.assertEqual(self.client.post('/api/homework/',{'payload':'{}'}).status_code,403)
        for kind in ['assignments','allocations','comments','exceptions']:
            self.assertEqual(self.client.post(f'/api/{kind}/','{}',content_type='application/json').status_code,403)
        self.assertEqual(self.client.get(f'/api/progress/{self.allocation.pk}/{self.member.pk}/update/').status_code,403)
    def test_foreign_assignment_same_class(self):
        other=Assignment.objects.create(title='Private',teacher=self.other)
        allocation=Allocation.objects.create(assignment=other,classroom=self.classroom,session=self.allocation.session,deadline=self.allocation.deadline)
        sub=Submission.objects.create(allocation=allocation,enrollment=self.member,content='Work',submitted_at=timezone.now())
        file=Attachment.objects.create(submission=sub,file=self.pdf(),original_name='de.pdf',size=14)
        self.assertEqual(self.client.get(f'/api/homework/{allocation.pk}/').status_code,404)
        self.assertEqual(self.client.get(f'/api/files/{file.pk}/preview/').status_code,403)
        response=self.client.post('/api/comments/',json.dumps({'submission':sub.pk,'content':'bad'}),content_type='application/json')
        self.assertEqual(response.status_code,400,response.content)
        self.assertFalse(any(r['allocation_id']==allocation.pk for r in self.client.get('/api/progress/').json()['rows']))
    def test_draft_hidden_from_staff_and_foreign_student(self):
        sub=Submission.objects.create(allocation=self.allocation,enrollment=self.member,content='Draft')
        file=Attachment.objects.create(submission=sub,file=self.pdf(),original_name='de.pdf',size=14)
        for user in [self.teacher,self.admin,self.stranger]:
            self.client.force_login(user); self.assertEqual(self.client.get(f'/api/files/{file.pk}/preview/').status_code,403)
        self.client.force_login(self.student)
        response=self.client.get(f'/api/files/{file.pk}/preview/'); self.assertEqual(response.status_code,200); response.close()
    def test_ended_class_is_view_only(self):
        self.classroom.end_date=timezone.localdate()-timedelta(days=1); self.classroom.save(update_fields=['end_date'])
        self.client.force_login(self.student)
        self.assertFalse(self.client.get('/api/homework/').json()['rows'][0]['can_submit'])
        self.assertEqual(self.client.post(f'/api/homework/{self.allocation.pk}/files/',{'files':[self.pdf()]}).status_code,400)
    def test_remove_and_soft_delete_preserve_submission(self):
        self.assertEqual(self.save(files=[self.pdf()]).status_code,200)
        file=Attachment.objects.get(assignment=self.assignment); data=self.payload(); data['remove_files']=[file.pk]
        self.assertEqual(self.save(data).status_code,200); self.assertFalse(Attachment.objects.filter(pk=file.pk).exists())
        sub=Submission.objects.create(allocation=self.allocation,enrollment=self.member,content='Work',submitted_at=timezone.now())
        self.assertEqual(self.client.delete(self.url).status_code,200)
        self.assertTrue(Submission.objects.filter(pk=sub.pk).exists()); self.assertFalse(self.client.get('/api/homework/').json()['rows'])
