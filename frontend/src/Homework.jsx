import React, { useEffect, useState } from "react";
import { api } from "./api";
import "./homework.css";

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
function Dialog({ title, close, children }) {
  return <div className="overlay"><section className="modal homework-modal" role="dialog" aria-modal="true" aria-label={title}>
    <button className="close" onClick={close} aria-label="Đóng">×</button><h2>{title}</h2>{children}
  </section></div>;
}

export default function Homework({ user, notify, refresh, open }) {
  const student = user.role === "HV", teacher = user.role === "GV";
  const [rows, setRows] = useState(null), [selected, select] = useState(null);
  const [detail, setDetail] = useState(null), [creating, create] = useState(false);
  const [error, setError] = useState(""), [q, search] = useState(""), [classroom, filterClass] = useState("");
  const [status, filterStatus] = useState("");
  async function reload() {
    try {
      const [list, current] = await Promise.all([
        api("homework/"), selected ? api(`homework/${selected}/`) : Promise.resolve(null),
      ]);
      setRows(list.rows); setDetail(current); setError("");
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { reload(); }, [refresh, selected]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) reload(); }, 30000);
    return () => clearInterval(timer);
  }, [selected]);
  const classes = [...new Set((rows || []).flatMap(r => student ? [r.classroom] : r.allocations.map(a => a.classroom)))];
  const filtered = (rows || []).filter(r => {
    const assigned = student ? [r] : r.allocations;
    return (!q || [r.title, r.description, ...assigned.map(a => a.classroom)].join(" ").toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi")))
      && (!classroom || assigned.some(a => a.classroom === classroom)) && (!student || !status || r.status === status);
  });
  function show(id) { setDetail(null); select(id); }
  return <div className="homework">
    {error && <div role="alert" className="alert">{error}<button onClick={reload}>Thử lại</button></div>}
    {!selected ? <>
      <div className="toolbar"><div><h2>{student ? "Bài tập được giao" : "Quản lý bài tập"}</h2>
        <p className="muted">{student ? "Xem đề bài, nộp bài làm và theo dõi nhận xét của giáo viên." : "Tạo bài, giao cho lớp và nhận xét bài làm của học viên tại cùng một nơi."}</p></div>
        {teacher && <button className="primary" onClick={() => create(true)}>＋ Tạo bài tập mới</button>}
      </div>
      <div className="filters">
        <label>Tìm bài tập<input value={q} onChange={e => search(e.target.value)} placeholder="Tiêu đề, mô tả hoặc lớp học" /></label>
        <label>Lớp học<select value={classroom} onChange={e => filterClass(e.target.value)}><option value="">Tất cả lớp</option>{classes.map(c => <option key={c}>{c}</option>)}</select></label>
        {student && <label>Trạng thái<select value={status} onChange={e => filterStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{["Chưa nộp", "Đã nộp", "Quá hạn", "Nộp muộn", "Không hợp lệ"].map(s => <option key={s}>{s}</option>)}</select></label>}
      </div>
      {!rows ? <p>Đang tải bài tập…</p> : !filtered.length ? <div className="card empty"><h3>{rows.length ? "Không tìm thấy bài tập phù hợp" : "Chưa có bài tập nào"}</h3></div> : filtered.map(r => <section className="card homework-card" key={r.id}>
        <div className="cardhead"><h3>{r.title}</h3>{student && <span className="badge">{r.status}</span>}</div>
        <p className="preserve-lines">{r.description || "Chưa có mô tả."}</p>
        {student ? <>
          <p className="muted">{r.classroom} · {r.session} · Hạn nộp: {date(r.deadline)}</p>
          <button className="primary" onClick={() => show(r.id)}>Xem bài tập</button>
          <Feedback comments={r.comments} />
        </> : <>
          <div className="tablewrap"><table><thead><tr><th>Lớp được giao</th><th>Buổi học</th><th>Hạn nộp</th><th>Thao tác</th></tr></thead><tbody>
            {r.allocations.map(a => <tr key={a.id}><td>{a.classroom}</td><td>{a.session} · {a.date.split("-").reverse().join("/")}</td><td>{date(a.deadline)}</td><td><button onClick={() => show(a.id)}>Chi tiết / Bài nộp</button></td></tr>)}
          </tbody></table></div>
          {!r.allocations.length && <p className="muted">Bài tập chưa được giao cho lớp nào.</p>}
          <Files files={r.files} />
          {teacher && <div className="rowactions">
            <button onClick={() => open({ type: "allocate", id: r.id })}>Giao thêm lớp</button>
            <button onClick={() => open({ type: "edit", kind: "assignments", id: r.id })}>Chỉnh sửa bài tập</button>
            <button className="danger" onClick={async () => {
              if (!confirm(`Bạn có chắc chắn xóa bài tập “${r.title}”?`)) return;
              try { await api(`assignments/${r.id}/`, null, "DELETE"); notify("Đã xóa bài tập."); await reload(); }
              catch (e) { setError(e.message); }
            }}>Xóa bài tập</button>
          </div>}
        </>}
      </section>)}
    </> : <>
      <button onClick={() => { select(null); setDetail(null); }}>← Quay lại danh sách bài tập</button>
      {!detail ? <p>Đang tải chi tiết bài tập…</p> : <>
        <section className="card homework-card"><span className="eyebrow">CHI TIẾT BÀI TẬP</span><h2>{detail.title}</h2>
          <p>{detail.classroom} · {detail.session} · {detail.date.split("-").reverse().join("/")}</p>
          <p>Giáo viên: <b>{detail.teacher}</b> · Hạn nộp: <b>{date(detail.deadline)}</b></p>
          <h3>Nội dung bài tập</h3><p className="preserve-lines">{detail.description || "Chưa có mô tả."}</p>
          <h3>Tài liệu đề bài</h3>{detail.files.length ? <Files files={detail.files} /> : <p className="muted">Không có tệp đính kèm.</p>}
          {teacher && <button onClick={() => open({ type: "edit", kind: "allocations", id: detail.id })}>Chỉnh sửa lớp / buổi / hạn nộp</button>}
        </section>
        {student ? <StudentSubmission key={detail.id} detail={detail} reload={reload} notify={notify} /> : <TeacherSubmissions key={detail.id} detail={detail} teacher={teacher} reload={reload} notify={notify} />}
      </>}
    </>}
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
  return <section className="card homework-card"><div className="cardhead"><h3>Bài nộp của bạn</h3><span className="badge">{sub?.status || (new Date(detail.deadline) < new Date() ? "Quá hạn" : "Chưa nộp")}</span></div>
    {error && <div className="alert" role="alert">{error}</div>}
    {sub?.submitted_at && <p>Thời gian nộp: <b>{date(sub.submitted_at)}</b></p>}
    {sub?.content && <p className="preserve-lines">{sub.content}</p>}
    <Files files={sub?.files} busy={busy} remove={detail.can_submit ? id => perform(() => api(`homework/${detail.id}/files/${id}/`, null, "DELETE")) : null} />
    {detail.can_submit ? <>
      <label className="homework-upload">Thêm file bài làm
        <input type="file" multiple accept={accept} disabled={busy} onChange={e => { const files = Array.from(e.target.files); e.target.value = ""; upload(files); }} />
        <small>PDF, DOCX, PNG, JPEG · Tối đa 10 file, mỗi file không quá 20 MB.</small>
      </label>
      {pending.length > 0 && <p role="status">Đang tải: {pending.join(", ")}…</p>}
      <p className="muted">File đã tải lên được lưu nháp. Giáo viên chỉ nhận được bài sau khi bạn xác nhận nộp.</p>
      {new Date(detail.deadline) < new Date() && <p className="alert">Đã qua hạn nộp. Bài gửi lúc này được ghi nhận là “Nộp muộn”.</p>}
      <button className="primary" disabled={busy || !sub?.files.length} onClick={() => confirmSubmit(true)}>Nộp bài</button>
    </> : <p className="muted">{sub?.submitted_at ? "Bài đã nộp. Muốn thay đổi file, hãy hủy nộp trước hạn rồi nộp lại." : "Bạn chỉ có quyền xem bài tập của lớp này."}</p>}
    {detail.can_cancel && <button className="danger" disabled={busy} onClick={() => {
      if (confirm("Bạn có chắc chắn hủy nộp bài?")) perform(async () => { await api(`homework/${detail.id}/submit/`, null, "DELETE"); notify("Đã hủy nộp. Các file được giữ lại để bạn sửa và nộp lại."); });
    }}>Hủy nộp bài</button>}
    <Feedback comments={sub?.comments} />
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

function TeacherSubmissions({ detail, teacher, reload, notify }) {
  const [view, setView] = useState(null), [q, search] = useState("");
  const selected = detail.students.find(s => s.id && s.id === view);
  return <section className="card homework-card"><div className="cardhead"><h3>Bài nộp của học viên</h3><span className="badge">{detail.students.filter(s => s.submitted_at).length}/{detail.students.length} đã nộp</span></div>
    <label>Tìm học viên<input value={q} onChange={e => search(e.target.value)} placeholder="Họ tên hoặc mã học viên" /></label>
    <div className="tablewrap"><table><thead><tr><th>Học viên</th><th>Trạng thái</th><th>Thời gian nộp</th><th>Nhận xét</th><th>Thao tác</th></tr></thead><tbody>
      {detail.students.filter(s => `${s.student} ${s.student_code}`.toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi"))).map(s => <tr key={s.enrollment}>
        <td><b>{s.student}</b><small className="student-code">{s.student_code}</small></td><td><span className="badge">{s.status}</span></td><td>{date(s.submitted_at)}</td>
        <td>{s.comments.length ? `${s.comments.length} nhận xét` : "Chưa có nhận xét"}</td>
        <td><button disabled={!s.submitted_at} onClick={() => setView(s.id)}>{teacher ? "Xem bài / Nhận xét" : "Xem bài nộp"}</button></td>
      </tr>)}
    </tbody></table></div>
    {!detail.students.length && <p className="muted">Lớp chưa có học viên.</p>}
    {selected && <Dialog title={`Bài làm · ${selected.student}`} close={() => setView(null)}>
      <p>{detail.title} · {detail.classroom} · {detail.session}</p><p>Thời gian nộp: {date(selected.submitted_at)}</p>
      <Files files={selected.files} />{selected.content && <p className="preserve-lines">{selected.content}</p>}
      <CommentEditor submission={selected} teacher={teacher} reload={reload} notify={notify} />
    </Dialog>}
  </section>;
}

function CommentEditor({ submission, teacher, reload, notify }) {
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
      </form> : <><p className="preserve-lines">{c.content}</p>{teacher && <div className="rowactions">
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
      <label>Mô tả bài tập<textarea value={description} onChange={e => describe(e.target.value)} /></label>
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
