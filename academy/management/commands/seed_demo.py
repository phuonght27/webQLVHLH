import secrets
from datetime import timedelta, time
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from academy.models import *
from academy.services import sync_schedule


class Command(BaseCommand):
    help = "Tạo dữ liệu minh họa, không ghi đè tài khoản hay mật khẩu đã có."

    @transaction.atomic
    def handle(self, *args, **options):
        credentials = []

        def account(email, name, role, creator=None):
            u = Account.objects.filter(email=email).first()
            if u:
                return u
            password = secrets.token_urlsafe(14)
            u = Account(
                email=email,
                full_name=name,
                role=role,
                gender="Nam",
                phone="0901234567",
                address="Cầu Giấy, Hà Nội",
                created_by=creator,
            )
            u.set_password(password)
            u.save()
            credentials.append(f"{email}\t{password}\t{role}")
            return u

        admin = account("quanly@example.com", "Nguyễn Văn An", "QLCN")
        manager = account("lop@example.com", "Lê Minh Cường", "QLLH", admin)
        teacher = account("giaovien@example.com", "Trần Thị Bích Ngọc", "GV", admin)
        students = [
            account(f"hocvien{i}@example.com", name, "HV", manager)
            for i, name in enumerate(
                [
                    "Nguyễn Minh Anh",
                    "Trần Quang Huy",
                    "Lê Khánh Linh",
                    "Phạm Gia Bảo",
                    "Vũ Hoàng Nam",
                ],
                1,
            )
        ]
        course, _ = Course.objects.get_or_create(
            symbol="BASIC",
            defaults={
                "name": "Basic",
                "description": "Khóa học nền tảng tiếng Anh, củng cố ngữ pháp và bốn kỹ năng.",
            },
        )
        for name, symbol in [
            ("Speed Up", "SPEEDUP"),
            ("Ready", "READY"),
            ("Pre IELTS", "PREIELTS"),
            ("Inter IELTS", "INTERIELTS"),
        ]:
            Course.objects.get_or_create(
                symbol=symbol,
                defaults={
                    "name": name,
                    "description": "Chương trình phát triển kỹ năng tiếng Anh toàn diện.",
                },
            )
        shift, _ = Shift.objects.get_or_create(
            name="Ca 1", defaults={"start": time(18, 0), "end": time(20, 0)}
        )
        room, _ = Room.objects.get_or_create(name="Phòng 201")
        Room.objects.get_or_create(name="Phòng 202")
        for name in ["Đầu vào", "Giữa khóa", "Cuối khóa"]:
            ExamType.objects.get_or_create(name=name)
        classroom = Classroom.objects.filter(course=course).first()
        if not classroom:
            classroom = Classroom.objects.create(
                course=course,
                manager=manager,
                teacher=teacher,
                start_date=timezone.localdate() - timedelta(days=14),
                end_date=timezone.localdate() + timedelta(days=60),
            )
        enrollments = [
            Enrollment.objects.get_or_create(classroom=classroom, student=s)[0]
            for s in students
        ]
        schedule, created = Schedule.objects.get_or_create(
            classroom=classroom, shift=shift, room=room
        )
        if created:
            sync_schedule(schedule, [2, 4, 6])
        assignment, created = Assignment.objects.get_or_create(
            title="Unit 1 · Listening & Vocabulary",
            teacher=teacher,
            defaults={
                "description": "Hoàn thành bài nghe Unit 1 và viết 10 câu sử dụng từ vựng mới. Nộp bài làm dưới dạng PDF hoặc nhập trực tiếp."
            },
        )
        session = (
            Session.objects.filter(classroom=classroom, date__lte=timezone.localdate())
            .order_by("-date")
            .first()
        )
        allocation, _ = Allocation.objects.get_or_create(
            assignment=assignment,
            classroom=classroom,
            defaults={
                "session": session,
                "deadline": timezone.now() + timedelta(days=7),
            },
        )
        sub, _ = Submission.objects.get_or_create(
            allocation=allocation,
            enrollment=enrollments[0],
            defaults={
                "content": "Bài làm Unit 1: Listening và Vocabulary.",
                "submitted_at": timezone.now(),
            },
        )
        Comment.objects.get_or_create(
            submission=sub,
            author=teacher,
            content="Em đã hoàn thành tốt phần từ vựng. Cần luyện nghe thêm các từ nối.",
        )
        exam = ExamType.objects.get(name="Đầu vào")
        for i, e in enumerate(enrollments):
            score = Decimal("5.0") + Decimal(i) / 2
            Grade.objects.get_or_create(
                enrollment=e,
                exam_type=exam,
                defaults={
                    "listening": score,
                    "reading": score + Decimal(".5"),
                    "speaking": score,
                    "writing": score,
                    "exam_date": timezone.localdate(),
                },
            )
        RetakeCriterion.objects.get_or_create(
            name="Điều kiện tham khảo",
            defaults={"min_score": Decimal("5"), "min_submission_rate": Decimal("80")},
        )
        if credentials:
            from django.conf import settings

            p = settings.VAR_DIR / "demo-credentials.txt"
            with p.open("a") as f:
                f.write("\n".join(credentials) + "\n")
            p.chmod(0o600)
            self.stdout.write(
                f"Tạo {len(credentials)} tài khoản. Thông tin đăng nhập lưu cục bộ tại {p}; không đưa vào Git."
            )
        else:
            self.stdout.write("Dữ liệu minh họa đã có; giữ nguyên mật khẩu và dữ liệu.")
