import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./class-management.css";

const titles = { courses: "Danh sách khóa học", shifts: "Danh sách ca học", classes: "Quản lý Danh Sách Lớp Học", schedules: "Quản Lý Lịch Học" };
const singular = { courses: "khóa học", shifts: "ca học", classes: "lớp học", schedules: "lịch học" };
const endpoint = (kind, id = "") => `class-management/${kind}/${id ? id + "/" : ""}`;
const equal = (a, b) => String(a) === String(b);
const displayDate = value => value ? value.split("-").reverse().join("/") : "—";

function Modal({ title, close, children }) {
  return <div className="overlay cm-overlay"><section className="modal cm-modal" role="dialog" aria-modal="true" aria-label={title}><button type="button" className="close" aria-label="Đóng" onClick={close}>×</button><h2>{title}</h2>{children}</section></div>;
}
function Confirmation({ title, message, confirm, cancel, busy }) {
  return <div className="overlay cm-confirm-overlay"><section className="modal cm-confirm" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2><p>{message}</p><div className="cm-footer"><button type="button" disabled={busy} onClick={cancel}>Hủy</button><button type="button" className="primary" disabled={busy} onClick={confirm}>{busy ? "Đang lưu…" : "Xác nhận"}</button></div></section></div>;
}

export default function ClassManagement({ kind, user, notify }) {
  const [rows, setRows] = useState(null), [options, setOptions] = useState(null), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [search, setSearch] = useState(""), [archived, setArchived] = useState(false);
  const [pendingFilters, changeFilters] = useState({}), [filters, applyFilters] = useState({});
  const [page, setPage] = useState(1), [detail, setDetail] = useState(null), [editor, edit] = useState(null), [action, setAction] = useState(null), [busy, setBusy] = useState(false), [history, showHistory] = useState(false);
  const request = useRef(0);
  const catalogue = ["courses", "shifts"].includes(kind), canWrite = !catalogue || user.role === "QLCN";
  async function load() {
    const id = ++request.current;
    try {
      const [list, choices] = await Promise.all([api(endpoint(kind) + `?archived=${archived ? 1 : 0}`), api("class-management/options/")]);
      if (id !== request.current) return;
      setRows(list.rows); setOptions(choices); setError("");
      if (detail) {
        const freshDetail = await api(endpoint("classes", detail.id));
        if (id === request.current) setDetail(current => current?.id === freshDetail.id ? freshDetail : current);
      }
    } catch (e) { if (id === request.current) setError(e.message); }
  }
  useEffect(() => { load(); return () => { request.current++; }; }, [kind, archived]);
  useEffect(() => { setPage(1); }, [search, JSON.stringify(filters), archived]);
  function chooseFilter(key, value) { changeFilters(p => ({ ...p, [key]: value })); }
  const filtered = (rows || []).filter(row => {
    const text = kind === "classes" ? [row.code, row.course_name] : kind === "schedules" ? [row.classroom, row.teacher, row.manager] : [row.name];
    return text.join(" ").toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))
      && (!filters.course || equal(row.course_id ?? row.course, filters.course))
      && (!filters.status || row.status === filters.status)
      && (!filters.room || equal(row.room_id, filters.room))
      && (!filters.shift || equal(row.shift_id, filters.shift));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, totalPages);
  const first = (currentPage - 1) * 10, visible = filtered.slice(first, first + 10);
  async function openEditor(row) {
    try {
      const value = kind === "schedules" && row ? await api(endpoint(kind, row.schedule_id)) : row;
      edit({ type: "edit", row: value || null });
    } catch (e) { setError(e.message); }
  }
  async function perform() {
    setBusy(true); setError("");
    try {
      await api(endpoint(action.kind || kind, action.id), action.action ? { _action: action.action } : null, action.action ? "PATCH" : "DELETE");
      setAction(null); notify("Đã cập nhật dữ liệu thành công."); await load();
    } catch (e) { setError(e.message); setAction(null); }
    finally { setBusy(false); }
  }
  function rowActions(row) {
    const id = kind === "schedules" ? row.schedule_id : row.id;
    if (!canWrite) return <span className="cm-muted">Chỉ xem</span>;
    return <div className="cm-row-actions">
      {kind === "classes" && <button onClick={async () => { try { setDetail(await api(endpoint("classes", row.id))); showHistory(false); } catch (e) { setError(e.message); } }}>◉ Xem chi tiết</button>}
      {!archived && kind !== "shifts" && <button disabled={(kind === "classes" && row.status === "Đã kết thúc") || (kind === "schedules" && row.past)} title={row.past ? "Buổi đã diễn ra không được sửa" : ""} onClick={() => openEditor(row)}>✎ Chỉnh sửa</button>}
      <button className={!archived && catalogue && !row.used ? "danger" : ""} onClick={() => setAction({ id,
        action: archived ? "restore" : !catalogue || row.used ? "archive" : null,
        message: archived ? "Khôi phục dữ liệu đã lưu trữ?" : !catalogue || row.used ? "Ẩn dữ liệu khỏi danh sách đang hoạt động? Lịch sử và bài tập được giữ lại." : "Bạn có chắc chắn muốn xóa dữ liệu chưa sử dụng này?" })}>{archived ? "↶ Khôi phục" : !catalogue || row.used ? "◉ Ẩn" : "▤ Xóa"}</button>
    </div>;
  }
  return <div className="class-management">
    {error && <div className="alert" role="alert">{error}<button onClick={load}>Thử lại</button></div>}
    {detail ? <>
      <button className="cm-back" onClick={() => setDetail(null)}>← Quay lại</button><h2>Chi tiết lớp học</h2>
      <div className="card cm-detail"><dl>{[["Mã lớp", detail.code], ["Tên khóa học", detail.course_name], ["Ngày bắt đầu", displayDate(detail.start_date)], ["Ngày kết thúc", displayDate(detail.end_date)], ["Giáo viên phụ trách", `${detail.teacher_code} · ${detail.teacher_name}`], ["QLLH phụ trách", `${detail.manager_code} · ${detail.manager_name}`]].map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl></div>
      <div className="card cm-list"><div className="cm-list-head"><h3>Danh sách học viên ({detail.members.filter(m => !m.left).length})</h3><button className="primary" disabled={detail.archived || detail.status === "Đã kết thúc"} onClick={() => edit({ type: "members", row: detail })}>＋ Thêm học viên</button></div>
        <label className="checkrow"><input type="checkbox" checked={history} onChange={e => showHistory(e.target.checked)} />Hiện lịch sử học viên đã rời lớp</label>
        <div className="tablewrap"><table><thead><tr><th>STT</th><th>Mã học viên</th><th>Tên học viên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{detail.members.filter(m => history || !m.left).map((member, index) => <tr key={member.id}><td>{index + 1}</td><td>{member.code}</td><td>{member.name}</td><td>{member.left ? "Đã rời lớp" : "Đang học"}</td><td>{!member.left && <button className="danger" disabled={detail.archived || detail.status === "Đã kết thúc"} onClick={() => setAction({ kind: "enrollments", id: member.id, message: `Xóa ${member.name} khỏi danh sách đang học? Lịch sử bài nộp và điểm vẫn được giữ.` })}>Xóa khỏi lớp</button>}</td></tr>)}</tbody></table></div>
      </div>
    </> : <>
      <h2>{titles[kind]}</h2>
      <div className="cm-toolbar"><form onSubmit={e => { e.preventDefault(); setSearch(query.trim()); }}><input aria-label="Từ khóa tìm kiếm" value={query} onChange={e => setQuery(e.target.value)} placeholder={catalogue ? "⌕  Nhập từ khóa tìm kiếm..." : "⌕  Nhập mã lớp, khóa học hoặc giáo viên..."} /><button className="primary">Tìm</button></form>
        <div>{canWrite && !archived && <button className="primary" disabled={!options} onClick={() => openEditor(null)}>＋ Tạo {singular[kind]}</button>}<button className={archived ? "primary" : ""} onClick={() => setArchived(!archived)}>♧ {archived ? "Đang lưu trữ" : "Lưu trữ"}</button></div>
      </div>
      {!catalogue && <div className="card cm-filters"><label>Khóa học<select aria-label="Lọc khóa học" value={pendingFilters.course || ""} onChange={e => chooseFilter("course", e.target.value)}><option value="">Tất cả khóa học</option>{options?.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {kind === "classes" ? <label>Trạng thái<select value={pendingFilters.status || ""} onChange={e => chooseFilter("status", e.target.value)}><option value="">Tất cả trạng thái</option>{["Chưa bắt đầu", "Đang hoạt động", "Đã kết thúc"].map(s => <option key={s}>{s}</option>)}</select></label> : <>
          <label>Phòng học<select value={pendingFilters.room || ""} onChange={e => chooseFilter("room", e.target.value)}><option value="">Tất cả phòng học</option>{options?.rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label>Ca học<select value={pendingFilters.shift || ""} onChange={e => chooseFilter("shift", e.target.value)}><option value="">Tất cả ca học</option>{options?.shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </>}
        <button className="primary" onClick={() => applyFilters({ ...pendingFilters })}>▽ Lọc</button><button className="danger" onClick={() => { changeFilters({}); applyFilters({}); setSearch(""); setQuery(""); }}>× Xóa bộ lọc</button>
      </div>}
      {catalogue && user.role === "QLLH" && <p className="cm-permission-note">Khóa học và ca học do Quản lý chi nhánh thiết lập. Bạn có thể xem và chọn khi tạo lớp/lịch học.</p>}
      <div className="card cm-list"><div className="tablewrap"><table><thead><tr>{(kind === "courses" ? ["STT", "Tên khóa học", "Mô tả", "Thao tác"] : kind === "shifts" ? ["STT", "Tên ca học", "Giờ bắt đầu", "Giờ kết thúc", "Thao tác"] : kind === "classes" ? ["STT", "Mã lớp", "Tên khóa học", "Mã GV", "Tên GV phụ trách", "Mã QLLH", "Tên QLLH phụ trách", "Số học viên", "Trạng thái lớp", "Thao tác"] : ["Buổi", "Mã lớp", "Tên khóa học", "Ngày học", "Ca học", "Phòng học", "GV phụ trách", "QLLH phụ trách", "Thao tác"]).map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>
        {visible.map((row, index) => <tr key={row.id}>
          {kind === "courses" ? <><td>{first + index + 1}</td><td><b>{row.name}</b></td><td className="cm-description">{row.description}</td></> : kind === "shifts" ? <><td>{first + index + 1}</td><td>{row.name}</td><td>{row.start}</td><td>{row.end}</td></> : kind === "classes" ? <><td>{first + index + 1}</td><td><b>{row.code}</b></td><td>{row.course_name}</td><td>{row.teacher_code}</td><td>{row.teacher_name}</td><td>{row.manager_code}</td><td>{row.manager_name}</td><td>{row.student_count}</td><td><span className={`cm-status ${row.status === "Đang hoạt động" ? "green" : "yellow"}`}>{row.status}</span></td></> : <><td>Buổi {row.number}</td><td><b>{row.classroom}</b></td><td>{row.course}</td><td>{displayDate(row.date)}{row.cancelled && <small className="danger">Đã hủy</small>}</td><td>{row.shift}<small className="cm-muted">{row.start} – {row.end}</small></td><td>{row.room}</td><td>{row.teacher}</td><td>{row.manager}</td></>}
          <td>{rowActions(row)}</td>
        </tr>)}
      </tbody></table></div>
      {!rows && !error ? <p className="cm-empty">Đang tải dữ liệu…</p> : !filtered.length && <p className="cm-empty">Không có dữ liệu phù hợp.</p>}
      <div className="cm-pagination"><span>Hiển thị {filtered.length ? first + 1 : 0} - {Math.min(first + 10, filtered.length)} trong tổng số {filtered.length} bản ghi</span><div><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Trang trước">‹</button><button className="primary">{currentPage}</button><button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Trang sau">›</button></div></div>
      </div>
    </>}
    {editor && options && <ManagementEditor key={`${kind}-${editor.row?.id || editor.type}`} kind={kind} spec={editor} options={options} close={() => edit(null)} saved={async () => { edit(null); notify("Đã lưu dữ liệu thành công."); await load(); }} />}
    {action && <Confirmation title="Xác nhận thao tác" message={action.message} cancel={() => !busy && setAction(null)} confirm={perform} busy={busy} />}
  </div>;
}

function ManagementEditor({ kind, spec, options, close, saved }) {
  const members = spec.type === "members", current = spec.row;
  const [values, setValues] = useState(() => ({ ...(current || {}), manager: options.manager?.id, students: [], days: current?.days || [] }));
  const [errors, setErrors] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false), [confirming, confirmSave] = useState(false);
  const [studentQuery, searchStudents] = useState(""), [courseQuery, searchCourses] = useState("");
  const title = members ? "Thêm học viên vào lớp" : `${current ? "Chỉnh sửa" : "Tạo"} ${singular[kind]}`;
  function update(key, value) { setValues(p => ({ ...p, [key]: value })); setErrors(p => ({ ...p, [key]: "" })); }
  const chosenCourse = options.courses.find(c => equal(c.id, values.course));
  const chosenClass = options.classes?.find(c => equal(c.id, values.classroom));
  const selectedShift = options.shifts.find(s => equal(s.id, values.shift));
  const activeMembers = new Set((members ? current.members.filter(m => !m.left).map(m => m.student_id) : []));
  const students = (options.students || []).filter(s => !activeMembers.has(s.id) && `${s.code} ${s.name}`.toLocaleLowerCase("vi").includes(studentQuery.toLocaleLowerCase("vi")));
  const required = (key, label, child) => <label className="cm-field"><span>{label} <em>*</em></span>{React.cloneElement(child, { "aria-label": label })}{errors[key] && <span className="cm-field-error">{errors[key]}</span>}</label>;
  const readonly = (label, value) => <label className="cm-field">{label}<input aria-label={label} disabled readOnly value={value || ""} /></label>;
  function selectStudents() {
    return <div className="cm-member-picker"><label>Tìm học viên<input value={studentQuery} onChange={e => searchStudents(e.target.value)} placeholder="Mã học viên, họ tên…" /></label><div>{students.map(s => <label className="checkrow" key={s.id}><input type="checkbox" checked={values.students.includes(s.id)} onChange={e => update("students", e.target.checked ? [...values.students, s.id] : values.students.filter(id => id !== s.id))} />{s.code} · {s.name}</label>)}{!students.length && <p className="cm-muted">Không có học viên phù hợp trong phạm vi quản lý.</p>}</div><small>{values.students.length} học viên đã chọn</small>{errors.students && <span className="cm-field-error">{errors.students}</span>}</div>;
  }
  function validate(e) {
    e.preventDefault(); const err = {};
    const fields = members ? ["students"] : kind === "courses" ? ["name", "description"] : kind === "shifts" ? ["name", "start", "end"] : kind === "classes" ? ["course", "teacher", "start_date", "end_date"] : ["classroom", "shift", "room", "days"];
    fields.forEach(key => { if (Array.isArray(values[key]) ? !values[key].length : !String(values[key] || "").trim()) err[key] = "Vui lòng nhập hoặc chọn thông tin này."; });
    if (kind === "classes" && values.start_date && values.end_date && values.start_date >= values.end_date) err.end_date = "Ngày kết thúc phải sau ngày bắt đầu.";
    if (kind === "shifts" && values.start && values.end && values.start >= values.end) err.end = "Giờ kết thúc phải sau giờ bắt đầu.";
    setErrors(err); if (!Object.keys(err).length) confirmSave(true);
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const targetKind = members ? "enrollments" : kind;
      let payload = members ? { classroom: current.id, students: values.students } : kind === "courses" ? { name: values.name, description: values.description } : kind === "shifts" ? { name: values.name, start: values.start, end: values.end } : kind === "classes" ? { course: values.course, teacher: values.teacher, start_date: values.start_date, end_date: values.end_date, ...(!current ? { students: values.students } : {}) } : { classroom: values.classroom, shift: values.shift, room: values.room, days: values.days };
      await api(endpoint(targetKind, !members && current ? current.id : ""), payload, !members && current ? "PATCH" : "POST"); await saved();
    } catch (e) { setError(e.message); confirmSave(false); }
    finally { setBusy(false); }
  }
  return <><Modal title={title} close={() => !busy && close()}><form onSubmit={validate} noValidate>
    {error && <div className="alert" role="alert">{error}</div>}
    {members ? <>{readonly("Lớp học", current.code)}{selectStudents()}</> : kind === "courses" ? <>
      {required("name", "Tên khóa học", <input maxLength={255} disabled={!!current} value={values.name || ""} onChange={e => update("name", e.target.value)} />)}
      {required("description", "Mô tả", <textarea maxLength={1500} value={values.description || ""} onChange={e => update("description", e.target.value)} />)}
    </> : kind === "shifts" ? <>
      {required("name", "Tên ca học", <input maxLength={10} value={values.name || ""} onChange={e => update("name", e.target.value)} />)}<div className="cm-form-grid">
      {required("start", "Giờ bắt đầu", <input type="time" value={values.start || ""} onChange={e => update("start", e.target.value)} />)}
      {required("end", "Giờ kết thúc", <input type="time" value={values.end || ""} onChange={e => update("end", e.target.value)} />)}</div>
    </> : kind === "classes" ? <>
      <div className="cm-form-grid"><div>{!current && <label>Tìm khóa học<input value={courseQuery} onChange={e => searchCourses(e.target.value)} placeholder="Nhập tên khóa học…" /></label>}
        {required("course", "Tên khóa học", <select aria-label="Tên khóa học" disabled={!!current} value={values.course || ""} onChange={e => update("course", e.target.value)}><option value="">Chọn khóa học</option>{options.courses.filter(c => equal(c.id, values.course) || c.name.toLocaleLowerCase("vi").includes(courseQuery.toLocaleLowerCase("vi"))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}</div>
        {readonly("Mã lớp", current?.code || chosenCourse?.next_code || "Hệ thống tự sinh khi lưu")}</div>
      {readonly("Quản lý lớp học phụ trách", `${options.manager.code} · ${options.manager.name}`)}
      <div className="cm-form-grid">{required("start_date", "Ngày bắt đầu", <input type="date" value={values.start_date || ""} onChange={e => update("start_date", e.target.value)} />)}{required("end_date", "Ngày kết thúc", <input type="date" value={values.end_date || ""} onChange={e => update("end_date", e.target.value)} />)}</div>
      {required("teacher", "Giáo viên phụ trách", <select aria-label="Giáo viên phụ trách" value={values.teacher || ""} onChange={e => update("teacher", e.target.value)}><option value="">Chọn giáo viên</option>{options.teachers.map(t => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</select>)}
      {!current && <><h3>Danh sách học viên</h3>{selectStudents()}</>}
      {current && <p className="cm-muted">Thay đổi ngày/giáo viên sẽ kiểm tra lại lịch sắp tới. Buổi đã diễn ra và dữ liệu học tập được giữ lại.</p>}
    </> : <>
      {required("classroom", "Mã lớp", <select aria-label="Mã lớp" disabled={!!current} value={values.classroom || ""} onChange={e => update("classroom", e.target.value)}><option value="">Chọn lớp học</option>{options.classes.map(c => <option key={c.id} value={c.id}>{c.code} · {c.course_name}</option>)}</select>)}
      <div className="cm-form-grid">{readonly("Ngày bắt đầu", displayDate(chosenClass?.start_date))}{readonly("Ngày kết thúc", displayDate(chosenClass?.end_date))}</div>
      {required("shift", "Ca học", <select aria-label="Ca học" disabled={!!current} value={values.shift || ""} onChange={e => update("shift", e.target.value)}><option value="">Chọn ca học</option>{options.shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start} – {s.end})</option>)}</select>)}
      {readonly("Giờ kết thúc", selectedShift?.end)}
      {required("room", "Phòng học", <select aria-label="Phòng học" value={values.room || ""} onChange={e => update("room", e.target.value)}><option value="">Chọn phòng học</option>{options.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>)}
      <h3>Ngày học trong tuần <em>*</em></h3><div className="cm-weekdays">{[2,3,4,5,6,7,8].map(day => <label className="checkrow" key={day}><input type="checkbox" checked={values.days.includes(day)} onChange={e => update("days", e.target.checked ? [...values.days, day] : values.days.filter(d => d !== day))} />{day === 8 ? "Chủ nhật" : `Thứ ${day}`}</label>)}</div>{errors.days && <span className="cm-field-error">{errors.days}</span>}
      <p className="cm-muted">Danh sách buổi học được sinh tự động trong thời gian lớp. Khi sửa lịch chỉ cập nhật các buổi chưa diễn ra.</p>
    </>}
    <div className="cm-footer"><button type="button" disabled={busy} onClick={close}>Hủy</button><button className="primary" disabled={busy}>{current && !members ? "Lưu" : "Tạo"}</button></div>
  </form></Modal>{confirming && <Confirmation title="Xác nhận lưu dữ liệu" message={`Bạn có chắc chắn muốn ${members ? "thêm học viên vào lớp" : current ? "lưu thay đổi" : `tạo ${singular[kind]}`}?`} cancel={() => !busy && confirmSave(false)} confirm={save} busy={busy} />}</>;
}
