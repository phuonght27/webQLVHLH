import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./RetakeReview.css";

const empty = { studentCode: "", classCode: "", examDate: "", reviewDate: "", note: "" };
export default function RetakeReview() {
  const [form, setForm] = useState(empty);
  const [record, setRecord] = useState(null);
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    const code = form.studentCode.trim();
    const classCode = form.classCode.trim();
    const current = ++sequence.current;
    setRecord(null); setChoices([]); setError("");
    if (!code) { setLoading(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ student_code: code });
        if (classCode) params.set("class_code", classCode);
        const result = await api("retake/student-lookup/?" + params.toString());
        if (sequence.current !== current) return;
        if (result.multiple) setChoices(result.classes || []);
        else { setRecord(result); setChoices(result.classes || []); }
      } catch (e) {
        if (sequence.current === current) setError(e.message || "Không thể tra cứu học viên.");
      } finally {
        if (sequence.current === current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [form.studentCode, form.classCode]);

  const metrics = [
    ["Số lần thiếu bài tập", record?.learning?.missing_assignments, "lần"],
    ["Thời gian thi sau khi kết thúc khóa học", form.examDate && record?.classroom?.end_date ? Math.round((new Date(form.examDate + "T00:00:00") - new Date(record.classroom.end_date + "T00:00:00")) / 86400000) : null, "ngày"],
    ["Điểm đầu vào", null, "điểm"],
    ["Điểm thi thực tế", null, "điểm"],
  ];
  return <section className="retake-review">
    <div className="retake-heading"><h2>Xét duyệt yêu cầu học lại của học viên</h2></div>
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">01</span><div><h3>Thông tin học viên</h3><p>Nhập mã học viên để tự động điền thông tin liên quan.</p></div></div>
      <div className="retake-fields">
        <label>Mã học viên <em>*</em><input autoComplete="off" value={form.studentCode} onChange={e => {setForm(f=>({...f,studentCode:e.target.value,classCode:""}));}} placeholder="Ví dụ: HV001" /></label>
        <label>Mã lớp học <em>*</em>{choices.length > 1 && !form.classCode ? <select value="" onChange={e => update("classCode",e.target.value)}><option value="">Chọn lớp học</option>{choices.map(c=><option key={c.code} value={c.code}>{c.code} · {c.course}</option>)}</select> : <input value={form.classCode || record?.classroom?.code || ""} onChange={e=>update("classCode",e.target.value)} placeholder="Tự động tra cứu / nhập mã lớp" />}</label>
        <label>Họ và tên học viên<input value={record?.student?.name || ""} placeholder="Tự động hiển thị" disabled /></label>
        <label>Tên khóa học<input value={record?.classroom?.course || ""} placeholder="Tự động hiển thị" disabled /></label>
        <label>Ngày thi thực tế <em>*</em><input type="date" value={form.examDate} onChange={e=>update("examDate",e.target.value)} /></label>
        <label>Ngày xét yêu cầu học lại <em>*</em><input type="date" value={form.reviewDate} onChange={e=>update("reviewDate",e.target.value)} /></label>
      </div>
      <div className={"retake-lookup-message" + (error ? " error" : "")} role="status">{loading ? "Đang tra cứu thông tin học viên…" : error || (choices.length > 1 && !form.classCode ? "Học viên thuộc nhiều lớp. Vui lòng chọn lớp học." : record ? "Đã tìm thấy học viên và cập nhật thông tin học tập." : "Thông tin sẽ tự động cập nhật sau khi nhập mã học viên.")}</div>
    </div>
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">02</span><div><h3>Thông tin học tập</h3><p>Thông tin được truy xuất từ hệ thống; dấu — biểu thị dữ liệu chưa xác định.</p></div></div>
      <div className="retake-metrics">{metrics.map(([title,value,unit])=><div className="retake-metric" key={title}><span className="retake-metric-label">{title}</span><strong>{value === null || value === undefined || !Number.isFinite(value) ? "—" : value}<small> {unit}</small></strong></div>)}</div>
      {record?.learning?.grades?.length > 0 && <div className="retake-grades"><strong>Điểm kiểm tra đã ghi nhận</strong><div>{record.learning.grades.map((g,i)=><span key={i}>{g.exam_type}: <b>{g.overall}</b> ({g.date})</span>)}</div><small>Chưa tự động phân loại điểm đầu vào/điểm thi thực tế vì cần xác nhận loại bài kiểm tra tương ứng.</small></div>}
    </div>
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">03</span><div><h3>Ghi chú và kiểm tra</h3><p>Ghi nhận thông tin bổ sung trước khi xét yêu cầu.</p></div></div>
      <label className="retake-note">Ghi chú của quản lý lớp học<textarea value={form.note} maxLength={500} onChange={e=>update("note",e.target.value)} placeholder="Nhập ghi chú (nếu có)..." /><span>{form.note.length}/500 ký tự</span></label>
      <div className="retake-actions"><span>Chưa tích hợp quy định xét duyệt chính thức; hệ thống chưa thể kết luận đủ điều kiện học lại.</span><button type="button" disabled>Kiểm tra điều kiện học lại</button></div>
    </div>
  </section>;
}
