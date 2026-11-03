import React, { useEffect, useState } from "react";
import { api } from "./api";
import "./grade-entry.css";

const SKILLS = ["listening", "speaking", "reading", "writing"];
const today = () => new Date().toLocaleDateString("en-CA");

export default function GradeEntry({ notify, done }) {
  const [options, setOptions] = useState({ classes: [], exam_types: [], members: [] });
  const [classroom, setClassroom] = useState("");
  const [examType, setExamType] = useState("");
  const [scores, setScores] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("grade-entry/options/").then(d => {
      if (active) setOptions(d);
    }).catch(e => active && setError(e.message));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!classroom) { setOptions(p => ({ ...p, members: [] })); return; }
    let active = true;
    setScores({});
    setOptions(p => ({ ...p, members: [] }));
    api(`grade-entry/options/?classroom=${encodeURIComponent(classroom)}`)
      .then(d => active && setOptions(d))
      .catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [classroom]);
  const changeScore = (id, skill, value) => {
    setScores(p => ({ ...p, [id]: { ...p[id], [skill]: value } }));
  };
  const overall = (id) => {
    const values = SKILLS.map(k => scores[id]?.[k]);
    if (values.some(v => v === undefined || v === "")) return "–";
    return (Math.round(values.reduce((sum, v) => sum + Number(v), 0) / 4 * 2) / 2).toFixed(1);
  };
  async function save(e) {
    e.preventDefault();
    setError("");
    const rows = options.members.filter(m => SKILLS.some(k => scores[m.enrollment]?.[k] !== undefined && scores[m.enrollment]?.[k] !== ""));
    if (!rows.length) { setError("Vui lòng nhập điểm cho ít nhất một học viên."); return; }
    for (const m of rows) {
      for (const k of SKILLS) {
        const raw = scores[m.enrollment]?.[k];
        const n = Number(raw);
        if (raw === undefined || raw === "" || !Number.isFinite(n) || n < 0 || n > 10 || n * 2 !== Math.round(n * 2)) {
          setError(`Điểm của ${m.name} phải đủ 4 kỹ năng, từ 0 đến 10 và theo bước 0.5.`);
          return;
        }
      }
    }
    if (!window.confirm(`Lưu điểm cho ${rows.length} học viên?`)) return;
    setBusy(true);
    try {
      await api("bulk/grades/", { rows: rows.map(m => ({
        enrollment: m.enrollment, exam_type: examType,
        ...Object.fromEntries(SKILLS.map(k => [k, scores[m.enrollment][k]])),
        exam_date: today(), note: "",
      })) });
      notify("Đã lưu điểm thành công.");
      done();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }
  return (
    <form className="grade-entry" onSubmit={save}>
      <h2>NHẬP ĐIỂM</h2>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="grade-entry-selectors">
        <label>Mã lớp <em>*</em>
          <select required value={classroom} onChange={e => setClassroom(e.target.value)}>
            <option value="">Chọn lớp học</option>
            {options.classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label>Loại bài kiểm tra <em>*</em>
          <select required value={examType} onChange={e => setExamType(e.target.value)}>
            <option value="">Chọn loại bài kiểm tra</option>
            {options.exam_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grade-entry-scroll">
        <table>
          <thead>
            <tr><th rowSpan="2">STT</th><th rowSpan="2">Tên khóa học</th><th rowSpan="2">Họ và tên</th><th rowSpan="2">Mã học viên</th><th rowSpan="2">Mã lớp</th><th colSpan="4">Nhập điểm kỹ năng</th><th rowSpan="2">Điểm overall</th></tr>
            <tr>{SKILLS.map(k => <th key={k}>{k[0].toUpperCase() + k.slice(1)}</th>)}</tr>
          </thead>
          <tbody>
            {options.members.map((m, i) => (
              <tr key={m.enrollment}>
                <td>{i + 1}</td><td>{m.course}</td><td>{m.name}</td><td>{m.student_code}</td><td>{m.class_code}</td>
                {SKILLS.map(k => <td key={k}><input type="number" min="0" max="10" step="0.5" aria-label={`${k} - ${m.name}`} value={scores[m.enrollment]?.[k] ?? ""} onChange={e => changeScore(m.enrollment, k, e.target.value)} /></td>)}
                <td><strong>{overall(m.enrollment)}</strong></td>
              </tr>
            ))}
            {!options.members.length && <tr><td colSpan="10">{classroom ? "Lớp chưa có học viên đang học." : "Chọn mã lớp để hiển thị danh sách học viên."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="grade-entry-note">ⓘ Mã lớp được hệ thống tự động sinh theo quy tắc và không thể chỉnh sửa. Điểm được nhập theo bước 0.5; chỉ lưu những học viên đã nhập điểm.</p>
      <div className="grade-entry-footer"><button type="button" onClick={done}>Hủy</button><button className="primary" disabled={busy || !classroom || !examType || !options.members.length}>{busy ? "Đang lưu…" : "Lưu điểm"}</button></div>
    </form>
  );
}
