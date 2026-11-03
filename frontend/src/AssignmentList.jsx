import React, { useEffect, useState } from "react";

export function submissionLabel(status, deadline, comments = []) {
  if (status === "Quá hạn") return "Thiếu bài";
  if (status === "Đã nộp" && (new Date(deadline) <= new Date() || comments.length)) return "Đúng hạn";
  return status;
}
export function statusTone(status) {
  return ["Đã nộp", "Đúng hạn"].includes(status) ? "green" : status === "Nộp muộn" ? "orange" : ["Thiếu bài", "Quá hạn"].includes(status) ? "red" : status === "Không hợp lệ" ? "purple" : "blue";
}
export default function AssignmentList({ rows, user, hasClasses, show, create, edit, remove, allocate, formatDate }) {
  const student = user.role === "HV", teacher = user.role === "GV";
  const [q, search] = useState(""), [classroom, filterClass] = useState(""), [status, filterStatus] = useState("");
  const [filters, toggleFilters] = useState(false), [page, setPage] = useState(1);
  const all = student ? rows || [] : (rows || []).flatMap(r => r.allocations.length ? r.allocations.map(a => ({ ...a, title: r.title, assignment_id: r.id, edited: r.edited, teacher: r.teacher })) : [{id:`draft-${r.id}`, assignment_id:r.id, title:r.title, classroom:"Chưa giao", session:"—", teacher:r.teacher, edited:r.edited, draft:true}]);
  const classes = [...new Set(all.filter(r => !r.draft).map(r => r.classroom))];
  const filtered = all.filter(r => (!q || `${r.title} ${r.classroom} ${r.teacher || ""}`.toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi")))
    && (!classroom || r.classroom === classroom) && (!status || (student ? r.status === status : status === "edited" ? r.edited : !r.edited)));
  useEffect(() => { setPage(1); }, [q, classroom, status]);
  const total = Math.max(1, Math.ceil(filtered.length / 10)), current = Math.min(page, total), first = (current - 1) * 10;
  return <section className="assignment-list-view">
    <div className="assignment-list-head"><div><h2>Danh sách bài tập</h2><p>{student ? "Bài tập được giao cho các lớp bạn đang hoặc đã học." : teacher ? "Quản lý bài tập do bạn tạo và giao; theo dõi bài làm trong các lớp phụ trách." : "Giám sát bài tập và bài nộp. Tạo/giao bài và nhận xét thuộc quyền giáo viên."}</p></div>{teacher && <button className="primary" onClick={create}>＋ Tạo bài tập</button>}</div>
    <div className="assignment-list-tools"><button onClick={() => toggleFilters(!filters)} aria-expanded={filters}>▽ Lọc</button><label><span className="progress-sr-only">Tìm bài tập</span><input aria-label="Tìm bài tập" value={q} onChange={e => search(e.target.value)} placeholder="Nhập tiêu đề, lớp học hoặc giáo viên…" /></label><span className="assignment-list-count">{filtered.length} lượt giao bài</span></div>
    {filters && <div className="assignment-list-filters"><label>Lớp học<select aria-label="Lọc lớp học" value={classroom} onChange={e => filterClass(e.target.value)}><option value="">Tất cả lớp học</option>{classes.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>{student ? "Trạng thái bài nộp" : "Trạng thái bài tập"}<select aria-label="Lọc trạng thái bài tập" value={status} onChange={e => filterStatus(e.target.value)}><option value="">Tất cả</option>{student ? ["Chưa nộp", "Đã nộp", "Quá hạn", "Nộp muộn", "Không hợp lệ"].map(s => <option key={s} value={s}>{s === "Quá hạn" ? "Thiếu bài" : s === "Đã nộp" ? "Đã nộp / Đúng hạn" : s}</option>) : <><option value="edited">Đã chỉnh sửa</option><option value="original">Chưa chỉnh sửa</option></>}</select></label><button onClick={() => { search(""); filterClass(""); filterStatus(""); }}>Xóa bộ lọc</button></div>}
    <div className="card assignment-list-card"><div className="tablewrap"><table className="assignment-list-table"><thead><tr><th>STT</th><th>Tiêu đề</th><th>Lớp học</th><th>Buổi học</th><th>Hạn nộp bài</th>{user.role === "QLCN" && <th>Giáo viên</th>}<th>Trạng thái bài tập</th><th>{student ? "Trạng thái bài nộp" : "Tiến độ nộp"}</th>{student && <th>Nộp bài</th>}<th>Xem chi tiết</th>{teacher && <th>Thao tác</th>}</tr></thead><tbody>
      {filtered.slice(first, first + 10).map((row, index) => <tr key={`${row.assignment_id || row.id}-${row.id}`}><td>{first + index + 1}</td><td><b>{row.title}</b>{student && row.comments?.length > 0 && <small className="assignment-comment-snippet">{row.comments.at(-1).content.slice(0, 100)}</small>}</td><td>{row.classroom}</td><td>{row.session}</td><td>{row.deadline ? formatDate(row.deadline) : "—"}</td>{user.role === "QLCN" && <td>{row.teacher}</td>}
        <td>{row.edited ? <span className="assignment-status green">Đã chỉnh sửa</span> : <span className="assignment-muted">{row.draft ? "Chưa giao" : "Đã giao"}</span>}</td>
        <td>{student ? <span className={`assignment-status ${statusTone(submissionLabel(row.status, row.deadline, row.comments))}`}>{submissionLabel(row.status, row.deadline, row.comments)}</span> : row.draft ? "—" : `${row.submitted_count ?? 0}/${row.student_count ?? 0} đã nộp hợp lệ`}</td>
        {student && <td>{row.can_submit ? <button onClick={() => show(row.id)}>Làm bài</button> : <span className="assignment-muted">Chỉ xem</span>}</td>}
        <td>{!row.draft && <button onClick={() => show(row.id)} aria-label={`Xem chi tiết ${row.title}`}>→ Chi tiết</button>}</td>
        {teacher && <td><div className="assignment-table-actions"><button onClick={() => edit(row.assignment_id)} aria-label={`Sửa ${row.title}`}>✎ Sửa</button><button onClick={() => allocate(row.assignment_id)}>Giao thêm lớp</button><button className="danger" onClick={() => remove(row)} aria-label={`Xóa ${row.title}`}>▤ Xóa</button></div></td>}
      </tr>)}
    </tbody></table></div>
      {!rows ? <p className="assignment-empty">Đang tải bài tập…</p> : !filtered.length && <p className="assignment-empty">{q || classroom || status ? "Không tìm thấy bài tập phù hợp." : student && hasClasses === false ? "Bạn chưa được xếp vào lớp học nào. Vui lòng liên hệ quản lý để được hỗ trợ." : student ? "Chưa có bài tập nào được giao." : "Chưa có bài tập nào."}</p>}
      <div className="assignment-pagination"><span>Hiển thị {filtered.length ? first + 1 : 0} - {Math.min(first + 10, filtered.length)} trong tổng số {filtered.length} lượt giao bài</span><div><button disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Trang trước">‹</button><button className="primary">{current}</button><button disabled={current >= total} onClick={() => setPage(current + 1)} aria-label="Trang sau">›</button></div></div>
    </div>
  </section>;
}
