import ActionMenu from "./ActionMenu";
import React, { useEffect, useState } from "react";
import { api } from "./api";
import "./homework.css";
import "./homework-roles.css";
import AssignmentList, { submissionLabel, statusTone } from "./AssignmentList";
import AssignmentEditor from "./AssignmentEditor";
import DescriptionEditor, { AssignmentDescription } from "./AssignmentDescription";
import SubmissionUpdateForm from "./SubmissionUpdateForm";
import { DetailIcon, StudentDetailInfo, StudentUploadArea, StudentFileTable, StudentFeedback } from "./StudentAssignmentDetail";

const date = (value) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";
const size = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const accept = ".pdf,.docx,.png,.jpg,.jpeg";
function Files({ files = [], remove, busy }) {
  return <ul className="homework-files">{files.map(f => <li key={f.id}>
    <a href={`/api/files/${f.id}/`}>{f.name}</a>
    <small>{size(f.size)}</small>
    {remove && <button disabled={busy} onClick={() => remove(f.id)} aria-label={`Xóa ${f.name}`}>Xóa</button>}
  </li>)}</ul>;
}
function Feedback({ comments = [] }) {
  return <div className="homework-feedback"><h4>Nhận xét của giáo viên</h4>
    {!comments.length ? <p className="muted">Chưa có nhận xét</p> : comments.map(c => <article key={c.id}>
      <b>{c.author}</b> <small>{date(c.created_at)}</small><p className="preserve-lines">{c.content}</p>
    </article>)}
  </div>;
}
function Dialog({ title, close, children, className = "" }) {
  return <div className="overlay"><section className={`modal homework-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
    <button className="close" onClick={close} aria-label="Đóng">×</button><h2>{title}</h2>{children}
  </section></div>;
}

export default function Homework({ user, notify, refresh, open }) {
  const student = user.role === "HV", teacher = user.role === "GV";
  const [rows, setRows] = useState(null), [selected, select] = useState(null);
  const [detail, setDetail] = useState(null), [creating, create] = useState(false);
  const [error, setError] = useState("");
  const [editing, editAssignment] = useState(null), [hasClasses, setHasClasses] = useState(true);
  async function reload() {
    try {
      const [list, current] = await Promise.all([
        api("homework/"), selected ? api(`homework/${selected}/`) : Promise.resolve(null),
      ]);
      setRows(list.rows); setHasClasses(list.has_classes); setDetail(current); setError("");
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { reload(); }, [refresh, selected]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) reload(); }, 30000);
    return () => clearInterval(timer);
  }, [selected]);
  function show(id) { setDetail(null); select(id); }
  return <div className="homework">
    {error && <div role="alert" className="alert">{error}<button onClick={reload}>Thử lại</button></div>}
    {!selected ? <>
      <AssignmentList rows={rows} user={user} hasClasses={hasClasses} show={show} create={() => create(true)} edit={editAssignment} formatDate={date}
        allocate={id => open({ type: "allocate", id })} remove={async row => {
          if (!confirm(`Bạn có chắc chắn xóa bài tập “${row.title}”?`)) return;
          try { await api(`homework/assignments/${row.assignment_id}/`, null, "DELETE"); notify("Đã xóa bài tập."); await reload(); } catch(e) { setError(e.message); }
        }} />
    </> : <>
      <button className={student ? "student-detail-back" : ""} onClick={() => { select(null); setDetail(null); }}>← Quay lại danh sách bài tập</button>
      {!detail ? <p>Đang tải chi tiết bài tập…</p> : student ? (
        <div className="student-assignment-layout">
          <StudentDetailInfo detail={detail} formatDate={date} />
          <StudentSubmission key={detail.id} detail={detail} reload={reload} notify={notify} />
          <StudentFeedback comments={detail.submission?.comments} formatDate={date} />
        </div>
      ) : <>
        <section className="card homework-card"><span className="eyebrow">CHI TIẾT BÀI TẬP</span><h2>{detail.title}</h2>
          <p>{detail.classroom} · {detail.session} · {detail.date.split("-").reverse().join("/")}</p>
          <p>Giáo viên: <b>{detail.teacher}</b> · Hạn nộp: <b>{date(detail.deadline)}</b></p>
          <h3>Nội dung bài tập</h3><AssignmentDescription text={detail.description || "Chưa có mô tả."} />
          <h3>Tài liệu đề bài</h3>{detail.files.length ? <Files files={detail.files} /> : <p className="muted">Không có tệp đính kèm.</p>}
          {teacher && <button onClick={() => editAssignment(detail.assignment_id)}>Chỉnh sửa bài tập / hạn nộp</button>}
        </section>
        <TeacherSubmissions key={detail.id} detail={detail} teacher={teacher} userId={user.id} reload={reload} notify={notify} />
      </>}
    </>}
    {editing && <AssignmentEditor id={editing} formatDate={date} close={() => editAssignment(null)} saved={async () => { editAssignment(null); await reload(); notify("Đã cập nhật bài tập."); }} />}
    {creating && <CreateHomework close={() => create(false)} done={async () => { create(false); await reload(); }} notify={notify} />}
  </div>;
}

function StudentSubmission({ detail, reload, notify }) {
  const sub = detail.submission;
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirming, confirmSubmit] = useState(false);
  const [pending, setPending] = useState([]);
  async function perform(fn) {
    setBusy(true); setError("");
    try { await fn(); await reload(); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function upload(files) {
    if (!files.length) return;
    setPending(files.map(f => f.name));
    await perform(async () => {
      const form = new FormData(); files.forEach(f => form.append("files", f));
      await api(`homework/${detail.id}/files/`, form); notify("Tải file bài làm thành công.");
    });
    setPending([]);
  }
  return <section className="card student-detail-work" aria-labelledby="student-work-heading">
    <h2 id="student-work-heading">Làm bài tập</h2>
    <div className="student-detail-banner"><DetailIcon name="info" /><span>{sub?.submitted_at
      ? "Bạn đã nộp bài. File bài làm đã được gửi đến giáo viên."
      : detail.can_submit ? "Vui lòng tải file bài làm của bạn lên hệ thống trước khi nộp bài."
      : "Bạn chỉ có quyền xem bài tập của lớp này."}</span></div>
    {error && <div className="alert" role="alert">{error}</div>}
    {sub?.submitted_at && <p>Thời gian nộp: <b>{date(sub.submitted_at)}</b></p>}
    {sub?.content && <p className="preserve-lines detail-existing-content">{sub.content}</p>}
    {detail.can_submit && <StudentUploadArea disabled={busy} onUpload={upload} />}
    <StudentFileTable files={sub?.files} pending={pending} busy={busy}
      remove={detail.can_submit ? id => perform(() => api(`homework/${detail.id}/files/${id}/`, null, "DELETE")) : null} />
    <div className="student-detail-notes"><strong><DetailIcon name="info" />Lưu ý:</strong><ul>
      <li>Bạn chỉ có thể xóa file trước khi nộp bài.</li>
      <li>Sau khi nộp bài, bạn sẽ không thể chỉnh sửa file đã upload.</li>
      <li>Muốn thay đổi bài đã nộp, hãy hủy nộp trước hạn rồi nộp lại.</li>
    </ul></div>
    {detail.can_submit && new Date(detail.deadline) < new Date() && <p className="alert">Đã qua hạn nộp. Bài gửi lúc này được ghi nhận là “Nộp muộn”.</p>}
    <div className="student-detail-actions">
      {detail.can_cancel && <button className="danger" disabled={busy} onClick={() => {
        if (confirm("Bạn có chắc chắn hủy nộp bài?")) perform(async () => { await api(`homework/${detail.id}/submit/`, null, "DELETE"); notify("Đã hủy nộp. Các file được giữ lại để bạn sửa và nộp lại."); });
      }}>Hủy nộp bài</button>}
      {detail.can_submit && <button className="primary student-detail-submit" disabled={busy || !sub?.files.length} onClick={() => confirmSubmit(true)}><DetailIcon name="send" />Nộp bài</button>}
    </div>
    {confirming && <Dialog title="Xác nhận nộp bài" close={() => !busy && confirmSubmit(false)}>
      <p>Bạn có chắc chắn nộp bài hay không?</p><h3>{detail.title}</h3><p>{detail.classroom} · {detail.session}</p>
      <Files files={sub?.files} />
      <div className="formfooter"><button disabled={busy} onClick={() => confirmSubmit(false)}>Hủy</button><button className="primary" disabled={busy} onClick={() => perform(async () => {
        await api(`homework/${detail.id}/submit/`, {}); confirmSubmit(false); notify("Nộp bài thành công.");
      })}>{busy ? "Đang nộp…" : "Xác nhận"}</button></div>
      {error && <p role="alert" className="alert">{error}</p>}
    </Dialog>}
  </section>;
}

function TeacherSubmissions({ detail, teacher, userId, reload, notify }) {
  const [view, setView] = useState(null), [q, search] = useState("");
  const [updating, update] = useState(null), [file, chooseFile] = useState(null);
  const [status, filter] = useState(""), [page, paginate] = useState(1);
  const filtered = detail.students.filter(s => `${s.student} ${s.student_code}`.toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi")) && (!status || s.status === status));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10)), current = Math.min(page, totalPages);
  useEffect(() => paginate(1), [q, status]);
  const selected = detail.students.find(s => s.id && s.id === view);
  return <section className="card homework-card"><div className="cardhead"><h3>Bài nộp của học viên</h3><span className="badge">{detail.students.filter(s => s.submitted_at).length}/{detail.students.length} đã nộp</span></div>
    <label>Tìm học viên<input value={q} onChange={e => search(e.target.value)} placeholder="Họ tên hoặc mã học viên" /></label>
    <label>Trạng thái bài nộp<select aria-label="Lọc bài nộp" value={status} onChange={e => filter(e.target.value)}><option value="">Tất cả trạng thái</option>{["Chưa nộp","Quá hạn","Đã nộp","Nộp muộn","Không hợp lệ"].map(s => <option key={s} value={s}>{s === "Quá hạn" ? "Thiếu bài" : s}</option>)}</select></label>
    <div className="tablewrap"><table><thead><tr><th>Học viên</th><th>Tệp bài làm</th><th>Trạng thái</th><th>Thời gian nộp</th><th>Nhận xét</th><th>Thao tác</th></tr></thead><tbody>
      {filtered.slice((current - 1) * 10, current * 10).map(s => <tr key={s.enrollment}>
        <td><b>{s.student}</b><small className="student-code">{s.student_code}</small></td><td>{s.files.length ? <Files files={s.files} /> : "—"}</td><td><span className={`assignment-status ${statusTone(submissionLabel(s.status, detail.deadline, s.comments))}`}>{submissionLabel(s.status, detail.deadline, s.comments)}</span>{s.change_reason && <small className="student-code">{s.change_reason}</small>}</td><td>{date(s.submitted_at)}</td>
        <td>{s.comments.length ? `${s.comments.length} nhận xét` : "Chưa có nhận xét"}</td>
        <td><ActionMenu><button disabled={!s.submitted_at} onClick={() => { setView(s.id); chooseFile(s.files[0] || null); }}>{teacher ? "Xem bài / Nhận xét" : "Xem bài nộp"}</button>{teacher && s.can_update_submission && <button onClick={() => update(s)}>Cập nhật</button>}</ActionMenu></td>
      </tr>)}
    </tbody></table></div>
    {!filtered.length && <p className="muted">Không có học viên phù hợp.</p>}
    <div className="assignment-pagination"><span>{filtered.length} học viên</span><div><button disabled={current <= 1} onClick={() => paginate(current - 1)}>‹</button><span>{current} / {totalPages}</span><button disabled={current >= totalPages} onClick={() => paginate(current + 1)}>›</button></div></div>
    {updating && <SubmissionUpdateForm row={{allocation_id:detail.id,enrollment_id:updating.enrollment}} statusLabels={{"Đã nộp":"Đúng hạn","Quá hạn":"Thiếu bài"}} statusTones={{"Đã nộp":"green","Quá hạn":"red","Nộp muộn":"orange"}} close={() => update(null)} saved={async () => {update(null);await reload();notify("Đã cập nhật bài nộp.");}} />}
    {selected && <Dialog className="submission-detail-dialog" title={`Bài làm · ${selected.student}`} close={() => setView(null)}>
      <p>{detail.title} · {detail.classroom} · {detail.session}</p><p>Thời gian nộp: {date(selected.submitted_at)}</p>
      <div className="assignment-work-viewer"><div className="assignment-work-files"><h3>Tệp bài làm</h3>{selected.files.map(f => <button key={f.id} aria-pressed={file?.id === f.id} onClick={() => chooseFile(f)}>{f.name}</button>)}<Files files={selected.files} /></div><div className="assignment-work-preview">{file && selected.files.some(f => f.id === file.id) ? /\.(pdf|png|jpe?g)$/i.test(file.name) ? <iframe title={`Xem ${file.name}`} src={`/api/files/${file.id}/preview/`} /> : <p>Tệp Word: <a href={`/api/files/${file.id}/`}>Tải xuống {file.name}</a> để xem nội dung.</p> : <p>Chọn một tệp để xem trước.</p>}</div></div>{selected.content && <p className="preserve-lines">{selected.content}</p>}
      <CommentEditor submission={selected} teacher={teacher} userId={userId} reload={reload} notify={notify} />
    </Dialog>}
  </section>;
}

function CommentEditor({ submission, teacher, userId, reload, notify }) {
  const [text, setText] = useState(""), [editing, edit] = useState(null), [value, setValue] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(fn) {
    setBusy(true); setError("");
    try { await fn(); await reload(); notify("Đã cập nhật nhận xét."); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="homework-feedback"><h3>Nhận xét của giáo viên</h3>
    {error && <p className="alert" role="alert">{error}</p>}
    {!submission.comments.length && <p className="muted">Chưa có nhận xét</p>}
    {submission.comments.map(c => <article key={c.id}><b>{c.author}</b> <small>{date(c.created_at)}</small>
      {editing === c.id ? <form onSubmit={e => { e.preventDefault(); save(async () => { await api(`comments/${c.id}/`, { submission: submission.id, content: value }, "PATCH"); edit(null); }); }}>
        <label>Chỉnh sửa nhận xét<textarea required maxLength={3000} value={value} onChange={e => setValue(e.target.value)} /></label>
        <button type="button" disabled={busy} onClick={() => edit(null)}>Hủy</button><button className="primary" disabled={busy || !value.trim()}>Lưu chỉnh sửa</button>
      </form> : <><p className="preserve-lines">{c.content}</p>{teacher && c.author_id === userId && <div className="rowactions">
        <button disabled={busy} onClick={() => { edit(c.id); setValue(c.content); }}>Sửa nhận xét</button>
        <button className="danger" disabled={busy} onClick={() => { if (confirm("Bạn có chắc chắn xóa nhận xét này không?")) save(() => api(`comments/${c.id}/`, null, "DELETE")); }}>Xóa nhận xét</button>
      </div>}</>}
    </article>)}
    {teacher && <form onSubmit={e => { e.preventDefault(); save(async () => { await api("comments/", { submission: submission.id, content: text }); setText(""); }); }}>
      <label>Nhận xét mới<textarea required maxLength={3000} value={text} onChange={e => setText(e.target.value)} placeholder="Nhập nhận xét về bài làm của học viên…" /></label>
      <p className="muted">{text.length}/3000 ký tự</p><button className="primary" disabled={busy || !text.trim()}>{busy ? "Đang lưu…" : "Lưu nhận xét"}</button>
    </form>}
  </div>;
}

function CreateHomework({ close, done, notify }) {
  const [classes, setClasses] = useState(null), [title, setTitle] = useState(""), [description, describe] = useState("");
  const [selected, select] = useState({}), [files, setFiles] = useState([]), [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false), [confirming, confirmCreate] = useState(false), [error, setError] = useState("");
  useEffect(() => { api("homework/?options=1").then(d => setClasses(d.classes)).catch(e => setError(e.message)); }, []);
  const chosen = (classes || []).filter(c => selected[c.id]);
  function update(id, key, value) { select(s => ({ ...s, [id]: { ...s[id], [key]: value } })); }
  function validate(e) {
    e.preventDefault(); const errs = {};
    if (!title.trim()) errs.title = "Tiêu đề bài tập không được để trống.";
    if (!chosen.length) errs.classes = "Vui lòng chọn ít nhất một lớp.";
    for (const c of chosen) {
      if (!selected[c.id].session) errs[`session${c.id}`] = `Vui lòng chọn buổi học cho lớp ${c.label}.`;
      if (!selected[c.id].deadline || new Date(selected[c.id].deadline) <= new Date()) errs[`deadline${c.id}`] = "Chọn hạn nộp ở tương lai.";
    }
    setErrors(errs); if (!Object.keys(errs).length) confirmCreate(true);
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.append("payload", JSON.stringify({ title, description, classes: chosen.map(c => ({ classroom: c.id, session: selected[c.id].session, deadline: new Date(selected[c.id].deadline).toISOString() })) }));
      files.forEach(f => form.append("files", f)); await api("homework/", form);
      notify("Giao bài tập thành công."); await done();
    } catch (e) { setError(e.message); confirmCreate(false); }
    finally { setBusy(false); }
  }
  const fieldError = key => errors[key] && <span className="field-error">{errors[key]}</span>;
  return <Dialog title={confirming ? "Xác nhận giao bài tập" : "Tạo và giao bài tập"} close={() => !busy && close()}>
    {error && <div className="alert" role="alert">{error}</div>}
    {confirming ? <>
      <h3>{title}</h3><p className="preserve-lines">{description}</p><ul>{files.map((f, i) => <li key={i}>{f.name} · {size(f.size)}</li>)}</ul>
      {chosen.map(c => <article key={c.id}><b>{c.label}</b><p>{c.sessions.find(s => String(s.id) === String(selected[c.id].session))?.label} · Hạn nộp: {date(selected[c.id].deadline)}</p></article>)}
      <div className="formfooter"><button disabled={busy} onClick={() => confirmCreate(false)}>Hủy</button><button className="primary" disabled={busy} onClick={save}>{busy ? "Đang giao bài…" : "Xác nhận giao bài"}</button></div>
    </> : <form onSubmit={validate} noValidate>
      <label>Tiêu đề bài tập<input maxLength={255} value={title} onChange={e => setTitle(e.target.value)} />{fieldError("title")}</label>
      <DescriptionEditor value={description} onChange={describe} />
      <label>Tệp đính kèm<input type="file" multiple accept={accept} onChange={e => { const added = Array.from(e.target.files); setFiles(prev => [...prev, ...added]); e.target.value = ""; }} /><small>PDF, DOCX, PNG, JPEG · Mỗi file tối đa 20 MB.</small></label>
      <ul className="homework-files">{files.map((f, i) => <li key={i}>{f.name} · {size(f.size)}<button type="button" onClick={() => setFiles(files.filter((_, j) => i !== j))}>Bỏ file</button></li>)}</ul>
      <h3>Chọn lớp học</h3>{fieldError("classes")}
      {classes === null ? <p>Đang tải lớp được phân công…</p> : !classes.length ? <p>Bạn chưa phụ trách lớp nào đang diễn ra.</p> : classes.map(c => <article key={c.id}>
        <label className="checkrow"><input type="checkbox" checked={!!selected[c.id]} onChange={e => {
          if (e.target.checked) select(s => ({ ...s, [c.id]: {} }));
          else select(s => { const next = { ...s }; delete next[c.id]; return next; });
        }} />{c.label}</label>
        {selected[c.id] && <div className="formgrid">
          <label>Buổi học · {c.label}<select value={selected[c.id].session || ""} onChange={e => update(c.id, "session", e.target.value)}><option value="">Chọn buổi đã / đang diễn ra</option>{c.sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>{fieldError(`session${c.id}`)}</label>
          <label>Hạn nộp · {c.label}<input type="datetime-local" disabled={!selected[c.id].session} value={selected[c.id].deadline || ""} onChange={e => update(c.id, "deadline", e.target.value)} />{fieldError(`deadline${c.id}`)}</label>
        </div>}
      </article>)}
      <div className="formfooter"><button type="button" onClick={close}>Hủy</button><button className="primary" disabled={!classes?.length}>Giao bài tập</button></div>
    </form>}
  </Dialog>;
}
