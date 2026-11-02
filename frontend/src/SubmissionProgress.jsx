import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./submission-progress.css";

const statusLabels = { "Đã nộp": "Đúng hạn", "Nộp muộn": "Nộp muộn", "Quá hạn": "Thiếu bài", "Không hợp lệ": "Không hợp lệ", "Chưa nộp": "Chưa nộp" };
const statusTones = { "Đã nộp": "green", "Nộp muộn": "orange", "Quá hạn": "red", "Không hợp lệ": "purple", "Chưa nộp": "blue" };
function Icon({ name }) {
  const paths = {
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    filter: <path d="M3 4h18l-7 8v7l-4 2v-9Z" />,
  };
  return <svg className="progress-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function same(left, right) { return String(left) === String(right); }

export default function SubmissionProgress({ refresh, notify }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [classroom, setClassroom] = useState(""), [session, setSession] = useState(""), [allocation, setAllocation] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState(""), [filterOpen, showFilters] = useState(false);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [exception, setException] = useState(null);
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api("progress/");
      setData(result);
      setClassroom(current => result.classes.some(c => same(c.id, current)) ? current : String(result.classes[0]?.id || ""));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [refresh]);
  const sessions = useMemo(() => (data?.sessions || []).filter(s => same(s.classroom_id, classroom)), [data, classroom]);
  useEffect(() => {
    setSession(current => sessions.some(s => same(s.id, current)) ? current : String(
      sessions.find(s => data?.allocations.some(a => same(a.session_id, s.id)))?.id || sessions[0]?.id || ""));
  }, [sessions, data]);
  const assignments = useMemo(() => (data?.allocations || []).filter(a => same(a.classroom_id, classroom) && same(a.session_id, session)), [data, classroom, session]);
  useEffect(() => { setAllocation(current => assignments.some(a => same(a.id, current)) ? current : String(assignments[0]?.id || "")); }, [assignments]);
  useEffect(() => { setPage(1); }, [classroom, session, allocation, query, status, pageSize]);
  const scopedRows = (data?.rows || []).filter(r => same(r.classroom_id, classroom) && same(r.session_id, session) && same(r.allocation_id, allocation));
  const filtered = scopedRows.filter(r => (!status || r.status === status) && `${r.student_code} ${r.student_name}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, totalPages);
  const first = (currentPage - 1) * pageSize, visible = filtered.slice(first, first + pageSize);
  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => startPage + i);
  const stats = [
    ["Đã nộp", "Đúng hạn", "green", "Bài đã được nộp trong thời hạn."],
    ["Nộp muộn", "Nộp muộn", "orange", "Bài được nộp sau thời hạn. Không bao gồm bài không hợp lệ."],
    ["Quá hạn", "Thiếu bài", "red", "Chưa có bài nộp tại thời điểm đã quá hạn."],
    ["Không hợp lệ", "Không hợp lệ", "purple", "Trạng thái kiểm duyệt “Không hợp lệ”."],
  ];
  return <section className="submission-progress" aria-label="Theo dõi trạng thái nộp bài">
    <h2>Trạng thái nộp bài</h2><p className="progress-description">Theo dõi tình trạng nộp bài của học viên theo lớp học và buổi học.</p>
    {error && <div className="alert" role="alert">{error}<button onClick={load}>Thử lại</button></div>}
    <div className="card progress-selection">
      <label><span>Lớp học thuộc phạm vi quản lý <em>*</em></span><select aria-label="Lớp học thuộc phạm vi quản lý" value={classroom} disabled={loading || !data?.classes.length} onChange={e => { setClassroom(e.target.value); setSession(""); setAllocation(""); }}>
        {!data?.classes.length && <option value="">Chưa có lớp học</option>}{data?.classes.map(c => <option key={c.id} value={c.id}>{c.code || c.label}</option>)}
      </select></label>
      <label><span>Danh sách buổi học <em>*</em></span><select aria-label="Danh sách buổi học" value={session} disabled={loading || !sessions.length} onChange={e => { setSession(e.target.value); setAllocation(""); }}>
        {!sessions.length && <option value="">Chưa có buổi học</option>}{sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select></label>
      <button className="progress-refresh" onClick={load} disabled={loading}><Icon name="refresh" />{loading ? "Đang tải…" : "Tải lại dữ liệu"}</button>
      {assignments.length > 1 && <label className="progress-assignment-select">Bài tập<select aria-label="Bài tập" value={allocation} onChange={e => setAllocation(e.target.value)}>{assignments.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>}
    </div>
    <div className="progress-stats">{stats.map(([raw, title, tone, note]) => <div className={`card progress-stat ${tone}`} key={raw}>
      <div><h3><i />{title}</h3><strong>{scopedRows.filter(r => r.status === raw).length}</strong></div><p>{note}</p>
    </div>)}</div>
    <div className="card progress-list">
      <div className="progress-list-header"><h3>Danh sách học viên ({filtered.length})</h3><div className="progress-list-tools">
        <label className="progress-search"><span className="progress-sr-only">Tìm học viên</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm theo mã học viên, họ tên…" /><Icon name="search" /></label>
        <button className={filterOpen || status ? "progress-filter active" : "progress-filter"} onClick={() => showFilters(!filterOpen)} aria-expanded={filterOpen} aria-controls="progress-status-filter"><Icon name="filter" />Bộ lọc{status ? " (1)" : ""}</button>
      </div></div>
      {filterOpen && <div id="progress-status-filter" className="progress-filter-panel"><label>Trạng thái nộp bài<select aria-label="Lọc trạng thái nộp bài" value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([raw, label]) => <option key={raw} value={raw}>{label}</option>)}</select></label><button onClick={() => { setStatus(""); setQuery(""); }}>Xóa bộ lọc</button></div>}
      <div className="progress-table-wrap"><table className="progress-table"><thead><tr>{["STT", "Mã học viên", "Họ tên", "Trạng thái nộp bài", "Lý do nộp muộn", "Lý do thay đổi trạng thái", "Cập nhật ngoại lệ"].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.map((row, index) => <tr key={`${row.allocation_id}-${row.student_id}`}>
          <td>{first + index + 1}</td><td><b>{row.student_code}</b></td><td>{row.student_name}</td>
          <td><span className={`progress-status ${statusTones[row.status] || "blue"}`}>{statusLabels[row.status] || row.status}</span></td>
          <td>{row.late_reason || "—"}</td><td>{row.change_reason || "—"}</td>
          <td>{row.can_update_exception && ["Nộp muộn", "Không hợp lệ"].includes(row.status) ? <button className="progress-exception" onClick={() => setException(row)}>Cập nhật ngoại lệ</button> : "—"}</td>
        </tr>)}</tbody>
      </table></div>
      {!visible.length && <p className="progress-empty" role="status">{loading ? "Đang tải dữ liệu…" : !classroom ? "Chưa có lớp học trong phạm vi quản lý." : !assignments.length ? "Buổi học này chưa có bài tập được giao." : "Không tìm thấy học viên phù hợp."}</p>}
      <div className="progress-pagination"><span>Hiển thị {filtered.length ? first + 1 : 0} - {Math.min(first + pageSize, filtered.length)} trong tổng số {filtered.length} học viên</span>
        <div className="progress-pages" aria-label="Phân trang"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Trang trước">‹</button>{pageNumbers.map(p => <button key={p} className={currentPage === p ? "selected" : ""} aria-current={currentPage === p ? "page" : undefined} onClick={() => setPage(p)} aria-label={`Trang ${p}`}>{p}</button>)}<button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Trang sau">›</button></div>
        <label className="progress-page-size"><span className="progress-sr-only">Số học viên mỗi trang</span><select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[10, 20, 50].map(n => <option key={n} value={n}>{n} / trang</option>)}</select></label>
      </div>
      <p className="progress-updated">{data?.updated_at && `Dữ liệu cập nhật: ${new Date(data.updated_at).toLocaleString("vi-VN", {timeZone:"Asia/Ho_Chi_Minh"})}`}</p>
    </div>
    {exception && <ExceptionForm row={exception} close={() => setException(null)} saved={async () => { setException(null); notify("Đã cập nhật ngoại lệ."); await load(); }} />}
  </section>;
}

function ExceptionForm({ row, close, saved }) {
  const [choices, setChoices] = useState(null), [status, setStatus] = useState(""), [reason, setReason] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { api("exceptions/?form=1").then(result => {
    const values = result.fields.find(f => f.name === "next_status")?.choices.filter(c => c.value) || [];
    setChoices(values); setStatus(values[0]?.value || "");
  }).catch(e => setError(e.message)); }, []);
  async function submit(event) {
    event.preventDefault();
    if (!confirm(`Xác nhận cập nhật trạng thái bài nộp của ${row.student_name}?`)) return;
    setBusy(true); setError("");
    try { await api("exceptions/", { submission: row.submission_id, reason: reason.trim(), next_status: status }); await saved(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="overlay"><form className="modal progress-exception-form" role="dialog" aria-modal="true" aria-label="Cập nhật ngoại lệ" onSubmit={submit}>
    <button className="close" type="button" disabled={busy} onClick={close} aria-label="Đóng">×</button><h2>Cập nhật ngoại lệ</h2>
    <p><b>{row.student_code} · {row.student_name}</b></p><p>{row.assignment} · {row.session}</p>
    {error && <div className="alert" role="alert">{error}</div>}
    <label>Trạng thái điều chỉnh<select aria-label="Trạng thái điều chỉnh" required value={status} disabled={!choices || busy} onChange={e => setStatus(e.target.value)}><option value="">Chọn trạng thái</option>{choices?.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <label>Lý do thay đổi trạng thái<textarea required maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
    <div className="formfooter"><button type="button" disabled={busy} onClick={close}>Hủy</button><button className="primary" disabled={busy || !status || !reason.trim()}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
  </form></div>;
}
