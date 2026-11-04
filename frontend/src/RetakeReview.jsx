import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./RetakeReview.css";
import "./RetakeResult.css";

const empty = { studentCode: "", classCode: "", examDate: "", reviewDate: "", actualScore: "", absentSessions: "", note: "" };
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
    ["Số buổi nghỉ học", form.absentSessions === "" ? null : Number(form.absentSessions), "buổi"],
    ["Số lần thiếu bài tập", record?.learning?.missing_assignments, "lần"],
    ["Thời gian thi sau khi kết thúc khóa học", form.examDate && record?.classroom?.end_date ? Math.round((new Date(form.examDate + "T00:00:00") - new Date(record.classroom.end_date + "T00:00:00")) / 86400000) : null, "ngày"],
    ["Điểm đầu vào", record?.learning?.input_score, "điểm"],
    ["Điểm thi thực tế", form.actualScore === "" ? null : Number(form.actualScore), "điểm"],
  ];
  const daysAfter = metrics[2][1];
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
    { label: "Số buổi nghỉ học", actual: form.absentSessions === "" ? null : Number(form.absentSessions), limit: "≤ 8 buổi", passed: form.absentSessions !== "" && Number(form.absentSessions) <= 8, unit: "buổi", note: "Số buổi nghỉ học vượt quá giới hạn tham khảo" },
    { label: "Số lần thiếu bài tập", actual: record?.learning?.missing_assignments, limit: "≤ 4 lần", unit: "lần", passed: record ? record.learning.missing_assignments <= 4 : false, note: "Đối chiếu số bài tập chưa nộp hợp lệ" },
    { label: "Thời gian thi sau khi kết thúc khóa học", actual: daysAfter, limit: "Không quá 1 tháng", unit: "ngày", passed: withinOneMonth, note: "Tính từ ngày kết thúc khóa học đến ngày thi thực tế" },
  ];
  const check = () => {
    let message = "";
    if (loading) message = "Đang tải dữ liệu học viên. Vui lòng chờ.";
    else if (!record) message = "Chưa tra cứu được học viên và lớp học. Vui lòng kiểm tra mã học viên, mã lớp.";
    else if (record.learning?.input_score === null || record.learning?.input_score === undefined) message = "Chưa tìm thấy điểm đầu vào đã nhập của học viên. Vui lòng kiểm tra loại bài kiểm tra đầu vào trong mục Điểm các bài kiểm tra.";
    else if (form.absentSessions === "" || !Number.isInteger(Number(form.absentSessions)) || Number(form.absentSessions) < 0) message = "Vui lòng nhập số buổi nghỉ học là số nguyên không âm.";
    else if (form.actualScore.trim() === "" || !Number.isFinite(Number(form.actualScore)) || Number(form.actualScore) < 0 || Number(form.actualScore) > 10) message = "Điểm thi thực tế phải nằm trong khoảng 0–10.";
    else if (!form.examDate) message = "Vui lòng nhập ngày thi thực tế.";
    else if (!form.reviewDate) message = "Vui lòng nhập ngày xét yêu cầu học lại.";
    else if (form.examDate >= form.reviewDate) message = "Ngày thi thực tế phải trước ngày xét yêu cầu học lại.";
    if (message) { setValidation(message); return; }
    setValidation(""); setShowResult(true);
  };
  if (showResult) {
    const passed = checks.filter(c => c.passed);
    const failed = checks.filter(c => !c.passed);
    const fmt = value => value ? value.split("-").reverse().join("/") : "—";
    const downloadReport = () => {
      const rows = [
        ["STT", "Điều kiện", "Giá trị thực tế", "Điều kiện đạt", "Kết quả", "Ghi chú"],
        ...checks.map((c, i) => [i + 1, c.label, String(c.actual) + " " + c.unit, c.limit, c.passed ? "Đạt" : "Không đạt", c.passed ? "Đáp ứng điều kiện" : c.note]),
      ];
      const quote = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const detail = [
        ["KẾT QUẢ XÉT YÊU CẦU HỌC LẠI"],
        ["Trạng thái", failed.length ? "Không đủ điều kiện theo các tiêu chí đã kiểm tra" : "Đạt các tiêu chí đã kiểm tra"],
        ["Mã học viên", record.student.code],
        ["Học viên", record.student.name],
        ["Mã lớp", record.classroom.code],
        ["Khóa học", record.classroom.course],
        ["Ngày kết thúc khóa học", fmt(record.classroom.end_date)],
        ["Ngày thi thực tế", fmt(form.examDate)],
        ["Ngày xét yêu cầu", fmt(form.reviewDate)],
        ["Số buổi nghỉ học", form.absentSessions],
        ["Số lần thiếu bài tập", record.learning.missing_assignments],
        ["Điểm đầu vào", record.learning.input_score],
        ["Điểm thi thực tế", form.actualScore],
        ["Ghi chú QLLH", form.note],
        [],
        ...rows, [], ["Tổng kết", passed.length + "/" + checks.length + " điều kiện đạt"],
        ["Lưu ý", "Kết quả sơ bộ; ngưỡng nghỉ học 8 buổi và thiếu bài tập 4 lần cần xác nhận chính thức."],
      ];
      const csv = "\uFEFF" + detail.map(row => row.map(quote).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ket-qua-hoc-lai-" + record.student.code.replace(/[^a-z0-9_-]/gi, "_") + ".csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    };
    return <section className="retake-review retake-results">
      <div className="retake-heading"><h2>Kết quả xét yêu cầu học lại</h2></div>
      <div className="rr-summary">
        <div className="rr-status">
          <span className={"rr-status-icon " + (failed.length ? "rr-bad" : "rr-good")}>{failed.length ? "✕" : "✓"}</span>
          <div><strong className={failed.length ? "rr-red" : "rr-green"}>{failed.length ? "KHÔNG ĐỦ ĐIỀU KIỆN HỌC LẠI" : "ĐẠT CÁC ĐIỀU KIỆN ĐÃ KIỂM TRA"}</strong><p>{failed.length ? "Học viên không đáp ứng một hoặc nhiều điều kiện xét yêu cầu học lại." : "Học viên đáp ứng các điều kiện hiện được hệ thống kiểm tra."}</p></div>
        </div>
        <div className="rr-facts">
          <div><b>Mã học viên:</b><strong>{record.student.code}</strong></div>
          <div><b>Học viên:</b><strong>{record.student.name}</strong></div>
          <div><b>Khóa học:</b><strong>{record.classroom.course}</strong></div>
          <div><b>Lớp học:</b><strong>{record.classroom.code}</strong></div>
          <div><b>Điểm đầu vào:</b><strong>{record.learning.input_score}</strong></div>
          <div><b>Điểm thi thực tế:</b><strong>{form.actualScore}</strong></div>
        </div>
        <div className="rr-facts">
          <div><b>Ngày thi thực tế:</b><strong>{fmt(form.examDate)}</strong></div>
          <div><b>Ngày xét yêu cầu học lại:</b><strong>{fmt(form.reviewDate)}</strong></div>
          <div><b>Ngày kết thúc khóa học:</b><strong>{fmt(record.classroom.end_date)}</strong></div>
        </div>
      </div>
      <div className="retake-panel rr-table-panel">
        <h3>Kết quả kiểm tra các điều kiện</h3>
        <div className="tablewrap"><table className="retake-result-table"><thead><tr><th>STT</th><th>Điều kiện</th><th>Giá trị thực tế</th><th>Điều kiện đạt</th><th>Kết quả</th><th>Ghi chú</th></tr></thead>
          <tbody>{checks.map((c,i)=><tr key={c.label}><td>{i+1}</td><td>{c.label}</td><td className={c.passed ? "rr-green" : "rr-red"}><b>{c.actual} {c.unit}</b></td><td>{c.limit}</td><td><span className={"rr-pill " + (c.passed ? "rr-pill-good" : "rr-pill-bad")}>{c.passed ? "✓ Đạt" : "✕ Không đạt"}</span></td><td>{c.passed ? "Đáp ứng điều kiện" : c.note}</td></tr>)}</tbody>
        </table></div>
        <div className="rr-total">{failed.length ? "❗" : "✓"} Học viên {failed.length ? "không đạt" : "đạt"} {passed.length}/{checks.length} điều kiện xét yêu cầu học lại.</div>
      </div>
      <div className="rr-bottom">
        <div className="retake-panel"><h3>Danh sách điều kiện không đạt</h3>{failed.length ? <ul className="rr-failed-list">{failed.map(c=><li key={c.label}>{c.label}: {c.actual} (yêu cầu {c.limit})</li>)}</ul> : <p className="rr-muted">Không có điều kiện không đạt.</p>}</div>
        <div className="retake-panel"><h3>Kết quả chi tiết</h3><p className="rr-muted">Thông tin xét yêu cầu học lại được tổng hợp trực tiếp từ dữ liệu hệ thống.</p><button className="rr-download" type="button" onClick={downloadReport}>↓ Tải file kết quả chi tiết (CSV)</button><button className="rr-back" type="button" onClick={()=>setShowResult(false)}>← Quay lại chỉnh sửa</button></div>
      </div>
      <p className="rr-disclaimer">Kết quả kiểm tra sơ bộ; ngưỡng nghỉ học 8 buổi và thiếu bài tập 4 lần là ngưỡng tham khảo theo ảnh mẫu, chưa phải quyết định phê duyệt chính thức.</p>
    </section>;
  }
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
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">02</span><div><h3>Thông tin học tập</h3></div></div>
      <div className="retake-metrics">{metrics.map(([title,value,unit])=><div className="retake-metric" key={title}><span className="retake-metric-label">{title}{(title === "Số buổi nghỉ học" || title === "Điểm thi thực tế") && <em className="retake-required"> *</em>}</span>{title === "Số buổi nghỉ học" ? <input aria-label={title} type="number" min="0" step="1" required value={form.absentSessions} onChange={e=>{update("absentSessions",e.target.value);setValidation("");}} placeholder="Nhập số buổi" /> : title === "Điểm thi thực tế" ? <input aria-label={title} type="number" min="0" max="10" step="0.5" required value={form.actualScore} onChange={e=>{update("actualScore",e.target.value);setValidation("");}} placeholder="Nhập điểm (0–10)" /> : <strong>{value === null || value === undefined || !Number.isFinite(value) ? "—" : value}<small> {unit}</small></strong>}</div>)}</div>
      {record?.learning?.grades?.length > 0 && <div className="retake-grades"><strong>Điểm kiểm tra đã ghi nhận</strong><div>{record.learning.grades.map((g,i)=><span key={i}>{g.exam_type}: <b>{g.overall}</b> ({g.date})</span>)}</div></div>}
    </div>
    <div className="retake-panel"><div className="retake-panel-title"><span className="retake-step">03</span><div><h3>Ghi chú và kiểm tra</h3><p>Ghi nhận thông tin bổ sung trước khi xét yêu cầu.</p></div></div>
      <label className="retake-note">Ghi chú của quản lý lớp học<textarea value={form.note} maxLength={500} onChange={e=>update("note",e.target.value)} placeholder="Nhập ghi chú (nếu có)..." /><span>{form.note.length}/500 ký tự</span></label>
      {validation && <p className="retake-validation" role="alert">{validation}</p>}
      <div className="retake-actions"><span>Điều kiện kiểm tra hiện theo ngưỡng tham khảo của ảnh mẫu, chưa thay thế quy định chính thức.</span><button type="button" onClick={check}>Kiểm tra điều kiện học lại</button></div>
    </div>
  </section>;
}
