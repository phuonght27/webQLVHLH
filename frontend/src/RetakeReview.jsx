import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./RetakeReview.css";

const empty = { studentCode: "", classCode: "", examDate: "", reviewDate: "", actualScore: "", note: "" };
export default function RetakeReview() {
  const [form, setForm] = useState(empty);
  const [record, setRecord] = useState(null);
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [validation, setValidation] = useState("");
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
    ["Điểm đầu vào", record?.learning?.input_score, "điểm"],
    ["Điểm thi thực tế", form.actualScore === "" ? null : Number(form.actualScore), "điểm"],
  ];
  const daysAfter = metrics[1][1];
  const endDate = record?.classroom?.end_date;
  const examDate = form.examDate;
  const withinOneMonth = (() => {
    if (!endDate || !examDate) return false;
    const [year, month, day] = endDate.split("-").map(Number);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const deadline = [year + Math.floor(month / 12), (month % 12) + 1, Math.min(day, lastDay)].map((n, i) => i === 0 ? String(n) : String(n).padStart(2, "0")).join("-");
    return examDate >= endDate && examDate <= deadline;
  })();
  const checks = [
    { label: "Số lần thiếu bài tập", actual: record?.learning?.missing_assignments, limit: "≤ 4 lần", passed: record ? record.learning.missing_assignments <= 4 : false, note: "Đối chiếu số bài tập chưa nộp hợp lệ" },
    { label: "Thời gian thi sau khi kết thúc khóa học", actual: daysAfter, limit: "Không quá 1 tháng", passed: withinOneMonth, note: "Tính từ ngày kết thúc khóa học đến ngày thi thực tế" },
  ];
  const canCheck = !!record && !!form.examDate && !!form.reviewDate && form.actualScore !== "" && Number.isFinite(Number(form.actualScore)) && Number(form.actualScore) >= 0 && Number(form.actualScore) <= 10 && form.reviewDate >= form.examDate && record.learning.input_score !== null;
  const check = () => {
    if (!canCheck) { setValidation("Vui lòng tra cứu học viên có điểm đầu vào, nhập điểm thi thực tế (0–10) và các ngày hợp lệ."); return; }
    setValidation(""); setShowResult(true);
  };
  if (showResult) return <section className="retake-review">
    <div className="retake-heading"><h2>Kết quả xét yêu cầu học lại</h2></div>
    <div className="retake-panel">
      <div className="retake-result-banner"><strong>{checks.every(c => c.passed) ? "ĐẠT CÁC ĐIỀU KIỆN ĐÃ KIỂM TRA" : "CHƯA ĐẠT CÁC ĐIỀU KIỆN ĐÃ KIỂM TRA"}</strong><p>Kết quả kiểm tra sơ bộ theo ngưỡng tham khảo trong ảnh mẫu; chưa phải quyết định phê duyệt học lại.</p></div>
      <div className="retake-result-info">
        <span><b>Mã học viên</b>{record.student.code}</span><span><b>Học viên</b>{record.student.name}</span>
        <span><b>Khóa học</b>{record.classroom.course}</span><span><b>Lớp học</b>{record.classroom.code}</span>
        <span><b>Điểm đầu vào</b>{record.learning.input_score}</span><span><b>Điểm thi thực tế</b>{form.actualScore}</span>
        <span><b>Ngày thi thực tế</b>{form.examDate}</span><span><b>Ngày xét yêu cầu</b>{form.reviewDate}</span>
      </div>
    </div>
    <div className="retake-panel"><h3>Kết quả kiểm tra các điều kiện</h3>
      <div className="tablewrap"><table className="retake-result-table"><thead><tr><th>STT</th><th>Điều kiện</th><th>Giá trị thực tế</th><th>Điều kiện tham khảo</th><th>Kết quả</th><th>Ghi chú</th></tr></thead><tbody>{checks.map((c,i)=><tr key={c.label}><td>{i+1}</td><td>{c.label}</td><td>{c.actual} {i===0?"lần":"ngày"}</td><td>{c.limit}</td><td><span className={c.passed?"retake-pass":"retake-fail"}>{c.passed?"Đạt":"Không đạt"}</span></td><td>{c.note}</td></tr>)}</tbody></table></div>
      <p className="retake-result-count">{checks.filter(c=>c.passed).length}/{checks.length} điều kiện tham khảo đạt.</p>
    </div>
    {!checks.every(c=>c.passed) && <div className="retake-panel"><h3>Danh sách điều kiện không đạt</h3><ul>{checks.filter(c=>!c.passed).map(c=><li key={c.label}>{c.label}: {c.actual} (yêu cầu {c.limit})</li>)}</ul></div>}
    <div className="retake-actions"><span>Ngưỡng 4 lần là tham khảo từ ảnh mẫu; thời hạn thi không quá 1 tháng theo yêu cầu, cần xác nhận trước khi sử dụng để xét duyệt chính thức.</span><button type="button" onClick={()=>setShowResult(false)}>← Quay lại chỉnh sửa</button></div>
  </section>;
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
        <label>Điểm thi thực tế <em>*</em><input type="number" min="0" max="10" step="0.5" value={form.actualScore} onChange={e=>update("actualScore",e.target.value)} placeholder="Nhập điểm thi thực tế (0–10)" /></label>
      </div>
      <div className={"retake-lookup-message" + (error ? " error" : "")} role="status">{loading ? "Đang tra cứu thông tin học viên…" : error || (choices.length > 1 && !form.classCode ? "Học viên thuộc nhiều lớp. Vui lòng chọn lớp học." : record ? "Đã tìm thấy học viên và cập nhật thông tin học tập." : "Thông tin sẽ tự động cập nhật sau khi nhập mã học viên.")}</div>
    </div>
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">02</span><div><h3>Thông tin học tập</h3><p>Thông tin được truy xuất từ hệ thống; dấu — biểu thị dữ liệu chưa xác định.</p></div></div>
      <div className="retake-metrics">{metrics.map(([title,value,unit])=><div className="retake-metric" key={title}><span className="retake-metric-label">{title}</span><strong>{value === null || value === undefined || !Number.isFinite(value) ? "—" : value}<small> {unit}</small></strong></div>)}</div>
      {record?.learning?.grades?.length > 0 && <div className="retake-grades"><strong>Điểm kiểm tra đã ghi nhận</strong><div>{record.learning.grades.map((g,i)=><span key={i}>{g.exam_type}: <b>{g.overall}</b> ({g.date})</span>)}</div><small>Chưa tự động phân loại điểm đầu vào/điểm thi thực tế vì cần xác nhận loại bài kiểm tra tương ứng.</small></div>}
    </div>
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">03</span><div><h3>Ghi chú và kiểm tra</h3><p>Ghi nhận thông tin bổ sung trước khi xét yêu cầu.</p></div></div>
      <label className="retake-note">Ghi chú của quản lý lớp học<textarea value={form.note} maxLength={500} onChange={e=>update("note",e.target.value)} placeholder="Nhập ghi chú (nếu có)..." /><span>{form.note.length}/500 ký tự</span></label>
      {validation && <p className="retake-validation" role="alert">{validation}</p>}
      <div className="retake-actions"><span>Điều kiện kiểm tra hiện theo ngưỡng tham khảo của ảnh mẫu, chưa thay thế quy định chính thức.</span><button type="button" onClick={check}>Kiểm tra điều kiện học lại</button></div>
    </div>
  </section>;
}
