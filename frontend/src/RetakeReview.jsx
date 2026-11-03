import React, { useState } from "react";
import "./RetakeReview.css";

export default function RetakeReview() {
  const [form, setForm] = useState({ studentCode: "", classCode: "", examDate: "", reviewDate: "", note: "" });
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const metrics = [
    ["▣", "Số buổi nghỉ học", "buổi"],
    ["▤", "Số lần thiếu bài tập", "lần"],
    ["◷", "Thời gian thi sau khi kết thúc khóa học", "ngày"],
    ["◎", "Điểm đầu vào", "điểm"],
    ["▥", "Điểm thi thực tế", "điểm"],
  ];
  return (
    <section className="retake-review">
      <h2>QUẢN LÝ DỮ LIỆU HỌC TẬP HỌC VIÊN</h2>
      <p className="retake-subtitle">Nhập dữ liệu xét yêu cầu học lại</p>
      <div className="retake-panel">
        <h3>Thông tin học viên</h3>
        <div className="retake-fields">
          <label>Mã học viên <em>*</em><input value={form.studentCode} onChange={e => change("studentCode", e.target.value)} placeholder="Nhập mã học viên" /></label>
          <label>Họ và tên học viên<input value="" placeholder="Hệ thống tự động hiển thị" disabled /></label>
          <label>Tên khóa học<input value="" placeholder="Hệ thống tự động hiển thị" disabled /></label>
          <label>Mã lớp học <em>*</em><input value={form.classCode} onChange={e => change("classCode", e.target.value)} placeholder="Nhập mã lớp học" /></label>
          <label>Ngày thi thực tế <em>*</em><input type="date" value={form.examDate} onChange={e => change("examDate", e.target.value)} /></label>
          <label>Ngày xét yêu cầu học lại <em>*</em><input type="date" value={form.reviewDate} onChange={e => change("reviewDate", e.target.value)} /></label>
        </div>
      </div>
      <div className="retake-panel">
        <h3>Thông tin học tập <small>(Hệ thống sẽ tự động truy xuất khi tích hợp dữ liệu xét học lại)</small></h3>
        <div className="retake-metrics">
          {metrics.map(([symbol, title, unit]) => <div className="retake-metric" key={title}>
            <span className="retake-metric-icon">{symbol}</span>
            <span className="retake-metric-label">{title}</span>
            <strong>-- <small>{unit}</small></strong>
          </div>)}
        </div>
      </div>
      <div className="retake-panel">
        <h3>Ghi chú (nếu có)</h3>
        <label className="retake-note">Ghi chú của quản lý lớp học
          <textarea maxLength={500} value={form.note} onChange={e => change("note", e.target.value)} placeholder="Nhập ghi chú..." />
          <span>{form.note.length}/500</span>
        </label>
        <div className="retake-actions">
          <span>Chức năng kiểm tra điều kiện học lại đang chờ kết nối API và quy định xét duyệt chính thức.</span>
          <button type="button" disabled title="Chưa tích hợp dữ liệu và quy tắc xét duyệt">⌕ Kiểm tra điều kiện học lại</button>
        </div>
      </div>
    </section>
  );
}
