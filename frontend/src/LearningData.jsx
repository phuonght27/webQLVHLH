import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./learning-data.css";

const tabs = [
  ["grades", "Điểm các bài kiểm tra", "Danh sách điểm các bài kiểm tra theo từng lớp tiếng Anh."],
  ["submissions", "Trạng thái nộp bài", "Danh sách trạng thái nộp bài theo khóa học, buổi học và bài tập."],
  ["comments", "Nhận xét bài tập", "Danh sách nhận xét bài tập theo khóa học và buổi học."],
];
const unique = (rows, key) => [...new Set(rows.map(x => String(x[key])))].sort((a,b) => a.localeCompare(b, "vi", {numeric:true}));
export default function LearningData({ selectedTab = "grades", hideTabs = false }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(selectedTab);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api("learning-data/").then(d => active && setData(d)).catch(e => active && setError(e.message)); return () => {active=false}; }, []);
  const rows = data?.[tab] || [];
  const fields = tab === "grades" ? [["course","Tên khóa học"],["exam","Loại bài kiểm tra"]] : tab === "submissions" ? [["course","Tên khóa học"],["session","Buổi học"],["status","Trạng thái nộp bài"]] : [["course","Tên khóa học"],["session","Buổi học"]];
  const filtered = useMemo(() => rows.filter(r => fields.every(([key]) => !filters[key] || String(r[key]) === filters[key]) && [r.course,r.classroom,r.exam,r.assignment,r.preview,r.session].join(" ").toLowerCase().includes(search.trim().toLowerCase())), [rows,filters,search,tab]);
  const visible = filtered.slice((page-1)*10,page*10);
  const reset = next => {setTab(next);setQuery("");setSearch("");setFilters({});setPage(1);setDetail(null);setShowFilters(false)};
  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p>Đang tải dữ liệu học tập…</p>;
  if (detail) return <section className="learning-data">
    <button className="learning-back" onClick={() => setDetail(null)}>← Quay lại tổng quan</button>
    <h2>Chi tiết {tab === "grades" ? "điểm các bài kiểm tra" : tab === "submissions" ? "trạng thái nộp bài" : "nhận xét bài tập"}</h2>
    <div className="learning-panel"><h3>Thông tin {tab === "grades" ? "bài kiểm tra" : "bài tập"}</h3>
      <div className="learning-meta"><span><b>Tên khóa học</b>{detail.course}</span><span><b>Mã lớp học</b>{detail.classroom}</span><span><b>{tab === "grades" ? "Loại bài kiểm tra" : "Buổi học"}</b>{tab === "grades" ? detail.exam : "Buổi "+detail.session}</span></div>
    </div>
    <div className="learning-panel"><h3>{tab === "grades" ? "Kết quả chi tiết" : tab === "submissions" ? "Chi tiết bài nộp" : "Nhận xét bài tập"}</h3>
      {tab !== "grades" && <p><b>Bài tập:</b> {detail.assignment} · <b>Hạn nộp:</b> {detail.deadline}</p>}
      <div className="tablewrap"><table><thead><tr>{(tab === "grades" ? ["Học viên","Mã học viên","Listening","Reading","Speaking","Writing","Overall"] : tab === "submissions" ? ["Học viên","Mã học viên","Trạng thái","Giờ nộp"] : ["Học viên","Mã học viên","Nhận xét"]).map(x => <th key={x}>{x}</th>)}</tr></thead>
      <tbody>{detail.records.map((r,i) => <tr key={i}><td>{r.student}</td><td>{r.student_code}</td>{tab === "grades" ? <><td>{r.listening}</td><td>{r.reading}</td><td>{r.speaking}</td><td>{r.writing}</td><td><strong>{r.overall}</strong></td></> : tab === "submissions" ? <><td>{r.status}</td><td>{r.submitted_at || "—"}</td></> : <td>{r.content}</td>}</tr>)}</tbody></table></div>
      {!detail.records.length && <p>Chưa có dữ liệu chi tiết.</p>}
    </div>
  </section>;
  return <section className="learning-data">
    {!hideTabs && <div className="learning-tabs">{tabs.map(([id,label]) => <button key={id} className={tab===id?"active":""} onClick={() => reset(id)}>{label}</button>)}</div>}
    <h2>Tổng quan {tabs.find(x=>x[0]===tab)[1].toLowerCase()}</h2><p className="learning-subtitle">{tabs.find(x=>x[0]===tab)[2]}</p>
    <div className="learning-toolbar"><form onSubmit={e=>{e.preventDefault();setSearch(query);setPage(1)}}><input placeholder="Tìm kiếm tên khóa học, mã lớp học..." value={query} onChange={e=>setQuery(e.target.value)}/><button className="primary">⌕ Tìm kiếm</button></form><button onClick={()=>setShowFilters(x=>!x)}>☷ Lọc</button></div>
    {showFilters && <div className="learning-filters">{fields.map(([key,label]) => <label key={key}>{label}<select value={filters[key]||""} onChange={e=>{setFilters(f=>({...f,[key]:e.target.value}));setPage(1)}}><option value="">Tất cả</option>{unique(rows,key).map(v=><option key={v} value={v}>{key==="session"?"Buổi "+v:v}</option>)}</select></label>)}<button onClick={()=>{setFilters({});setPage(1)}}>Xóa lọc</button></div>}
    <div className="learning-panel"><div className="tablewrap"><table><thead><tr>{(tab==="grades"?["STT","Tên khóa học","Mã lớp học","Loại bài kiểm tra","Điểm Overall","Chi tiết"]:tab==="submissions"?["STT","Tên khóa học","Mã lớp học","Buổi học","Trạng thái nộp bài","Chi tiết"]:["STT","Tên khóa học","Mã lớp học","Buổi","Nhận xét","Xem chi tiết"]).map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={r.id}><td>{(page-1)*10+i+1}</td><td>{r.course}</td><td>{r.classroom}</td><td>{tab==="grades"?r.exam:"Buổi "+r.session}</td><td>{tab==="grades"?<strong>{r.overall}</strong>:tab==="submissions"?r.status:r.preview}</td><td><button onClick={()=>setDetail(r)}>◉ Xem chi tiết</button></td></tr>)}</tbody></table></div>{!visible.length&&<p className="learning-empty">Không có dữ liệu phù hợp.</p>}
    <div className="learning-pagination"><span>Hiển thị {filtered.length?(page-1)*10+1:0} đến {Math.min(page*10,filtered.length)} trong tổng số {filtered.length} kết quả</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button><span>{page} / {Math.max(1,Math.ceil(filtered.length/10))}</span><button disabled={page*10>=filtered.length} onClick={()=>setPage(p=>p+1)}>›</button></div></div></div>
  </section>;
}
