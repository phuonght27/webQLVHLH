import React, { useEffect, useState } from "react";
import { api } from "./api";

const skills = ["listening", "speaking", "reading", "writing"];
const today = () => new Date().toLocaleDateString("en-CA");

export default function GradeSingleAdd({ notify, done }) {
  const [classes, setClasses] = useState([]);
  const [members, setMembers] = useState([]);
  const [classroom, setClassroom] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [types, setTypes] = useState([]);
  const [examType, setExamType] = useState("");
  const [scores, setScores] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const student = members.find(m => String(m.enrollment) === String(enrollment)) || null;

  useEffect(() => {
    let active = true;
    api("grade-entry/options/")
      .then(d => { if (active) { setClasses(d.classes || []); setTypes(d.exam_types || []); } })
      .catch(e => active && setError(e.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setMembers([]);
    setEnrollment("");
    setExamType("");
    setScores({});
    setError("");
    if (!classroom) return;
    let active = true;
    setLoading(true);
    api(`grade-entry/options/?classroom=${encodeURIComponent(classroom)}`)
      .then(d => { if (active) { setMembers(d.members || []); setTypes(d.exam_types || []); } })
      .catch(e => active && setError(e.message))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classroom]);

  const valid = skills.every(k => scores[k] !== undefined && scores[k] !== "" && Number.isFinite(Number(scores[k])) && Number(scores[k]) >= 0 && Number(scores[k]) <= 10 && Number(scores[k]) * 2 === Math.round(Number(scores[k]) * 2));
  const overall = valid ? (Math.round(skills.reduce((s, k) => s + Number(scores[k]), 0) / 4 * 2) / 2).toFixed(2) : "0.00";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!student || !classroom || !examType || !valid) { setError("Vui lòng chọn loại bài kiểm tra và nhập đủ 4 điểm từ 0 đến 10, theo bước 0.5."); return; }
    if ((student.used_exam_types || []).includes(Number(examType))) { setError("Học viên đã có điểm cho loại bài kiểm tra này."); return; }
    setBusy(true);
    try {
      await api("grades/", { enrollment: student.enrollment, exam_type: Number(examType), ...scores, exam_date: today(), note: "" }, "POST");
      notify("Đã thêm điểm thành công.");
      done();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <form className="grade-single-add" onSubmit={submit}>
    <h2>THÊM ĐIỂM</h2>
    {error && <p className="alert" role="alert">{error}</p>}
    <h3>Chọn học viên</h3>
    <div className="grade-single-selectors">
      <label>Mã lớp <em>*</em>
        <select required value={classroom} onChange={e => setClassroom(e.target.value)}>
          <option value="">Chọn lớp được phân công</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label>Học viên <em>*</em>
        <select required value={enrollment} disabled={!classroom || loading} onChange={e => { setEnrollment(e.target.value); setExamType(""); setScores({}); }}>
          <option value="">{loading ? "Đang tải học viên..." : "Chọn học viên"}</option>
          {members.map(m => <option key={m.enrollment} value={m.enrollment}>{m.name} - {m.student_code}</option>)}
        </select>
      </label>
    </div>
    {classroom && !loading && !members.length && <p>Không tìm thấy học viên đang học trong lớp.</p>}
    <h3>Thông tin học viên</h3>
    <div className="grade-single-info">
      <label>Mã lớp<input value={student?.class_code || ""} readOnly /></label>
      <label className="grade-single-course">Tên khóa học<input value={student?.course || ""} readOnly /></label>
      <label>Mã HV<input value={student?.student_code || ""} readOnly /></label>
      <label className="grade-single-name">Họ và tên<input value={student?.name || ""} readOnly /></label>
      <label>Điểm Overall<input value={overall} readOnly /></label>
    </div>
    <h3>Thông tin điểm</h3>
    <label className="grade-single-exam">Loại bài kiểm tra <em>*</em>
      <select required value={examType} onChange={e => setExamType(e.target.value)}>
        <option value="">Chọn loại bài kiểm tra</option>
        {types.filter(t => !student?.used_exam_types?.includes(Number(t.id))).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
    <div className="grade-single-scores">
      {skills.map(k => <label key={k}>Điểm {k[0].toUpperCase() + k.slice(1)} <em>*</em>
        <input type="number" min="0" max="10" step="0.5" required placeholder="Nhập điểm" value={scores[k] ?? ""} onChange={e => setScores(p => ({ ...p, [k]: e.target.value }))} />
      </label>)}
    </div>
    <div className="grade-single-footer"><button className="primary" disabled={busy || !student || !examType || !valid}>{busy ? "Đang lưu…" : "Lưu điểm"}</button></div>
  </form>;
}
