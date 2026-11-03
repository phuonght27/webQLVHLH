import { AssignmentDescription } from "./AssignmentDescription";
import React, { useRef, useState } from "react";
import "./student-detail.css";

export function DetailIcon({ name, className = "" }) {
  const paths = {
    upload: <><path d="M7 18H6a4 4 0 0 1-.5-8A6.5 6.5 0 0 1 18 8a5 5 0 0 1 0 10h-1" /><path d="M12 21V10m-4 4 4-4 4 4" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4ZM11 13 22 2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    comment: <><path d="M21 11c0 5-4 8-9 8H9l-5 3 1-6a7 7 0 0 1-2-5c0-5 4-8 9-8s9 3 9 8Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
  };
  return <svg className={`detail-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.info}</svg>;
}

function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileType({ name }) {
  const extension = name.split(".").pop().toLowerCase();
  const type = ["doc", "docx"].includes(extension) ? "word" : extension === "pdf" ? "pdf" : "image";
  return <span className={`detail-file-type ${type}`} aria-hidden="true">{type === "word" ? "W" : type === "pdf" ? "PDF" : "IMG"}</span>;
}

export function StudentDetailInfo({ detail, formatDate }) {
  const status = detail.submission?.status || (new Date(detail.deadline) < new Date() ? "Quá hạn" : "Chưa nộp");
  return <section className="card student-detail-info" aria-labelledby="student-detail-heading">
    <h2 id="student-detail-heading">Thông tin chi tiết bài tập</h2>
    <div className="student-detail-field"><h3>Tiêu đề</h3><div className="detail-readonly detail-title">{detail.title}</div></div>
    <div className="student-detail-field"><h3>Mô tả</h3><div className="detail-readonly preserve-lines"><AssignmentDescription text={detail.description || "Chưa có mô tả."} /></div></div>
    <div className="student-detail-field"><h3>Tài liệu đính kèm</h3>
      {detail.files.length ? <ul className="detail-attachments">{detail.files.map(file => <li key={file.id}>
        <FileType name={file.name} /><a href={`/api/files/${file.id}/`} className="detail-file-name">{file.name}</a>
        <span className="detail-file-size">{fileSize(file.size)}</span>
        <a className="detail-download" href={`/api/files/${file.id}/`} aria-label={`Tải xuống ${file.name}`}><DetailIcon name="download" /></a>
      </li>)}</ul> : <p className="detail-empty-text">Không có tài liệu đính kèm.</p>}
    </div>
    <dl className="student-detail-metadata">
      <div><dt>Lớp học</dt><dd>{detail.classroom}</dd></div>
      <div><dt>Buổi học</dt><dd>{detail.session}</dd></div>
      <div><dt>Thời hạn nộp bài</dt><dd>{formatDate(detail.deadline)}</dd></div>
      <div><dt>Trạng thái bài nộp</dt><dd><span className={`detail-status ${["Đã nộp", "Nộp muộn"].includes(status) ? "submitted" : ""}`}>{status}</span></dd></div>
    </dl>
  </section>;
}

export function StudentUploadArea({ disabled, onUpload }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  return <div className="student-detail-field"><h3>Thêm file bài làm</h3>
    <div className={`student-dropzone${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) onUpload(Array.from(event.dataTransfer.files)); }}>
      <div className="student-dropzone-action"><DetailIcon name="upload" /><span>Kéo và thả file vào đây hoặc</span>
        <button type="button" className="detail-choose-file" disabled={disabled} onClick={() => input.current.click()}>Chọn file</button>
      </div>
      <input ref={input} className="detail-file-input" type="file" multiple accept=".docx,.pdf,.jpg,.jpeg,.png" aria-label="Thêm file bài làm" disabled={disabled}
        onChange={event => { const files = Array.from(event.target.files); event.target.value = ""; onUpload(files); }} />
      <p>Hỗ trợ: .docx, .pdf, .jpg, .jpeg, .png</p>
      <p>Dung lượng tối đa cho mỗi file: 20 MB · Tối đa 10 file</p>
    </div>
  </div>;
}

export function StudentFileTable({ files = [], pending = [], busy, remove }) {
  return <div className="student-detail-field"><h3>Danh sách file đã chọn ({files.length + pending.length})</h3>
    <div className="student-file-table-wrap"><table className="student-file-table"><thead><tr><th>Tên file</th><th>Dung lượng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{files.map(file => <tr key={file.id}>
        <td><div className="detail-file-cell"><FileType name={file.name} /><a href={`/api/files/${file.id}/`}>{file.name}</a></div></td>
        <td>{fileSize(file.size)}</td><td><span className="detail-upload-success">Tải lên thành công</span></td>
        <td>{remove ? <button className="detail-remove-file" disabled={busy} onClick={() => remove(file.id)} aria-label={`Xóa ${file.name}`}><DetailIcon name="trash" /></button> : <span className="detail-empty-text">—</span>}</td>
      </tr>)}
      {pending.map((name, index) => <tr key={`pending-${index}`}><td><div className="detail-file-cell"><FileType name={name} /><span>{name}</span></div></td><td>—</td><td><span className="detail-status" role="status">Đang tải…</span></td><td>—</td></tr>)}
      {!files.length && !pending.length && <tr><td colSpan={4} className="detail-no-files">Chưa có file bài làm.</td></tr>}
    </tbody></table></div>
  </div>;
}

export function StudentFeedback({ comments = [], formatDate }) {
  return <section className="card student-detail-feedback" aria-labelledby="student-feedback-heading"><h2 id="student-feedback-heading">Nhận xét của giáo viên</h2>
    {!comments.length ? <div className="student-feedback-empty"><DetailIcon name="comment" /><p>Chưa có nhận xét</p></div> : comments.map(comment => <article key={comment.id}>
      <div className="student-feedback-author"><b>{comment.author}</b><time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time></div>
      <p className="preserve-lines">{comment.content}</p>
    </article>)}
  </section>;
}
