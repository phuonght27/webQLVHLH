import React, { useEffect, useState } from "react";
import { api } from "./api";
import DescriptionEditor from "./AssignmentDescription";

function inputDate(value) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Ho_Chi_Minh", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).format(new Date(value));
  return parts.replace(" ", "T");
}
export default function AssignmentEditor({ id, close, saved, formatDate }) {
  const [data, setData] = useState(null), [title, setTitle] = useState(""), [description, setDescription] = useState("");
  const [deadlines, changeDeadlines] = useState({}), [removed, remove] = useState([]), [files, addFiles] = useState([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [confirmation, confirm] = useState(false);
  useEffect(() => { let active=true; api(`homework/assignments/${id}/`).then(d => { if(!active)return;setData(d);setTitle(d.title);setDescription(d.description);changeDeadlines(Object.fromEntries(d.allocations.map(a=>[a.id,inputDate(a.deadline)]))); }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;}; },[id]);
  function validate(event) {
    event.preventDefault();setError("");
    if(!title.trim()){setError("Tiêu đề bài tập không được để trống.");return;}
    for(const a of data.allocations){if(!deadlines[a.id]||new Date(deadlines[a.id]+"+07:00")<=new Date()){setError(`Vui lòng chọn hạn nộp ở tương lai cho lớp ${a.classroom}.`);return;}}
    confirm(true);
  }
  async function save(){setBusy(true);setError("");try{
    const form=new FormData();form.append("payload",JSON.stringify({title,description,deadlines:data.allocations.map(a=>({id:a.id,deadline:new Date(deadlines[a.id]+"+07:00").toISOString()})),remove_files:removed}));files.forEach(f=>form.append("files",f));
    await api(`homework/assignments/${id}/`,form);await saved();
  }catch(e){setError(e.message);confirm(false);}finally{setBusy(false);}}
  return <div className="overlay assignment-editor-overlay"><section className="modal assignment-editor" role="dialog" aria-modal="true" aria-label="Chỉnh sửa bài tập">
    <button className="close" disabled={busy} onClick={close} aria-label="Đóng">×</button><h2>{confirmation ? "Xác nhận thay đổi bài tập" : "Chỉnh sửa bài tập"}</h2>
    {error&&<div className="alert" role="alert">{error}</div>}
    {!data?<p>Đang tải bài tập…</p>:confirmation?<>
      <h3>{title}</h3><p className="preserve-lines">{description}</p><p>{files.length} tệp mới · {removed.length} tệp được bỏ khỏi đề bài.</p>
      {data.allocations.map(a=><p key={a.id}>{a.classroom} · {a.session} · {formatDate(new Date(deadlines[a.id]+"+07:00"))}</p>)}
      <div className="formfooter"><button disabled={busy} onClick={()=>confirm(false)}>Hủy</button><button className="primary" disabled={busy} onClick={save}>{busy?"Đang lưu…":"Xác nhận"}</button></div>
    </>:<form onSubmit={validate}>
      <label>Tiêu đề <em>*</em><input aria-label="Tiêu đề bài tập" required maxLength={255} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <DescriptionEditor value={description} onChange={setDescription}/>
      <label>Tệp đính kèm<input type="file" multiple accept=".docx,.pdf,.jpg,.jpeg,.png" onChange={e=>{const chosen=Array.from(e.target.files);addFiles(prev=>[...prev,...chosen]);e.target.value="";}}/></label>
      <p className="assignment-muted">DOCX, PDF, hình ảnh · Tối đa 20 MB mỗi tệp.</p>
      <ul className="assignment-edit-files">{data.files.filter(f=>!removed.includes(f.id)).map(f=><li key={f.id}><a href={`/api/files/${f.id}/`}>{f.name}</a><button type="button" className="danger" onClick={()=>remove(prev=>[...prev,f.id])} aria-label={`Bỏ ${f.name}`}>×</button></li>)}{files.map((f,i)=><li key={`new-${i}`}><span>{f.name}</span><button type="button" onClick={()=>addFiles(prev=>prev.filter((_,n)=>n!==i))} aria-label={`Bỏ ${f.name}`}>×</button></li>)}</ul>
      <h3>Danh sách lớp, buổi học và hạn nộp bài</h3><div className="tablewrap"><table><thead><tr><th>Lớp học</th><th>Buổi học</th><th>Hạn nộp bài (giờ Việt Nam)</th></tr></thead><tbody>{data.allocations.map(a=><tr key={a.id}><td>{a.classroom}</td><td>{a.session}</td><td><input aria-label={`Hạn nộp ${a.classroom}`} type="datetime-local" required value={deadlines[a.id]||""} onChange={e=>changeDeadlines(prev=>({...prev,[a.id]:e.target.value}))}/></td></tr>)}</tbody></table></div>
      <p className="assignment-muted">Lớp và buổi học được giữ nguyên. Thay đổi sẽ cập nhật đến tất cả lớp đã giao.</p>
      <div className="formfooter"><button type="button" onClick={close}>Hủy</button><button className="primary">Lưu thay đổi</button></div>
    </form>}
  </section></div>;
}
