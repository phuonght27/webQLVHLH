import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./submission-update-form.css";

function UploadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M4 14v7h16v-7" /></svg>;
}

function UpdateFileArea({ label, inputId, file, onChange, disabled, error }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  function pick(files) {
    if (!disabled && files.length) onChange(files.length > 1 ? files : files[0]);
  }
  return <div className="submission-update-row"><label htmlFor={inputId}>{label} <small>(nếu có)</small></label><div>
    <div className={`submission-update-dropzone${dragging ? " dragging" : ""}`}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); pick(Array.from(e.dataTransfer.files)); }}>
      <div><UploadIcon /><span>Kéo và thả file vào đây hoặc</span><button type="button" disabled={disabled} onClick={() => input.current.click()}>Chọn file</button></div>
      <input ref={input} id={inputId} type="file" accept=".docx,.pdf,.jpg,.jpeg,.png" disabled={disabled} className="submission-update-file-input"
        onChange={e => { const files = Array.from(e.target.files); e.target.value = ""; pick(files); }} />
      <p>Hỗ trợ file DOCX, PDF, hình ảnh. Dung lượng tối đa 20 MB.</p>
    </div>
    {file && <div className="submission-update-selected"><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small><button type="button" disabled={disabled} onClick={() => onChange(null)} aria-label={`Bỏ ${file.name}`}>×</button></div>}
    {error && <span className="submission-update-error">{error}</span>}
  </div></div>;
}

export default function SubmissionUpdateForm({ row, close, saved, statusLabels, statusTones }) {
  const [detail, setDetail] = useState(null), [reason, setReason] = useState("");
  const [status, setStatus] = useState("keep");
  const [evidence, setEvidence] = useState(null), [work, setWork] = useState(null);
  const [errors, setErrors] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const reasonInput = useRef(null);
  const endpoint = `progress/${row.allocation_id}/${row.enrollment_id}/update/`;
  useEffect(() => {
    let active = true;
    api(endpoint).then(result => { if (active) setDetail(result); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [endpoint]);
  useEffect(() => { if (detail) reasonInput.current?.focus(); }, [detail]);
  function choose(kind, value) {
    let message = "";
    if (Array.isArray(value)) message = "Mỗi khu vực chỉ được chọn một tệp.";
    else if (value && value.size > 20 * 1024 * 1024) message = "Dung lượng file vượt quá giới hạn cho phép (20MB).";
    else if (value && !/\.(docx|pdf|jpe?g|png)$/i.test(value.name)) message = "Vui lòng chọn file DOCX, PDF, JPG hoặc PNG.";
    if (!message) (kind === "evidence" ? setEvidence : setWork)(value);
    setErrors(previous => ({ ...previous, [kind]: message }));
  }
  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) { setErrors(previous => ({ ...previous, reason: "Vui lòng nhập lý do cập nhật." })); return; }
    if (!detail || errors.evidence || errors.work) return;
    setBusy(true); setError("");
    try {
      const payload = new FormData(); payload.append("reason", reason.trim());
      if (detail.can_mark_invalid) payload.append("status", status);
      if (evidence) payload.append("evidence", evidence);
      if (work) payload.append("work_file", work);
      await api(endpoint, payload); await saved();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="overlay submission-update-overlay"><form className="modal submission-update-form" role="dialog" aria-modal="true" aria-labelledby="submission-update-title" onSubmit={submit}>
    <button className="close" type="button" disabled={busy} onClick={close} aria-label="Đóng">×</button>
    <h2 id="submission-update-title">Cập nhật bài nộp của học viên</h2>
    {error && <div className="alert" role="alert">{error}</div>}
    {!detail ? <p role="status">{error ? "Không tải được thông tin bài nộp. Vui lòng đóng form và mở lại." : "Đang tải thông tin bài nộp…"}</p> : <>
      <div className="submission-update-row"><span>Học viên</span><div className="submission-update-readonly">{detail.student_code} - {detail.student_name}</div></div>
      <div className="submission-update-row"><span>Lớp học</span><div className="submission-update-readonly">{detail.classroom}</div></div>
      <div className="submission-update-row"><span>Buổi học</span><div className="submission-update-readonly">{detail.session}</div></div>
      <div className="submission-update-row"><span>Deadline bài tập</span><div className="submission-update-readonly">{detail.deadline}</div></div>
      <div className="submission-update-row"><span>Trạng thái hiện tại</span><div><span className={`progress-status ${statusTones[detail.status] || "blue"}`}>{statusLabels[detail.status] || detail.status}</span></div></div>
      {detail.can_mark_invalid && <div className="submission-update-row"><label htmlFor="submission-update-status">Trạng thái cập nhật</label><div><select id="submission-update-status" value={status} disabled={busy} onChange={e => setStatus(e.target.value)}>
        <option value="keep">Giữ trạng thái hiện tại / tính theo thời điểm nộp</option>
        <option value="invalid">Không hợp lệ</option>
      </select>{status === "invalid" && <small>Đánh dấu bài làm không hợp lệ. Vui lòng ghi rõ lý do bên dưới.</small>}</div></div>}
      <div className="submission-update-row reason"><label htmlFor="submission-update-reason">Lý do cập nhật <em>*</em></label><div>
        <textarea ref={reasonInput} id="submission-update-reason" maxLength={500} required value={reason} disabled={busy}
          placeholder={'Nhập lý do cập nhật\n(VD: Học viên gửi bài qua Zalo sau deadline, ốm có lý do...)'}
          onChange={e => { setReason(e.target.value); setErrors(previous => ({ ...previous, reason: "" })); }} />
        <span className="submission-update-counter">{reason.length}/500</span>{errors.reason && <span className="submission-update-error">{errors.reason}</span>}
      </div></div>
      <UpdateFileArea label="Minh chứng lý do" inputId="submission-update-evidence" file={evidence} onChange={value => choose("evidence", value)} disabled={busy} error={errors.evidence} />
      <UpdateFileArea label="Tệp bài làm" inputId="submission-update-work" file={work} onChange={value => choose("work", value)} disabled={busy} error={errors.work} />
      {!!detail.files.length && <div className="submission-update-row"><span>Bài làm hiện có</span><ul className="submission-update-existing">{detail.files.map(file => <li key={file.id}><a href={`/api/files/${file.id}/`}>{file.name}</a></li>)}</ul></div>}
      <div className="submission-update-actions"><button type="button" disabled={busy} onClick={close}>Hủy</button><button className="primary" disabled={busy || !reason.trim() || !!errors.evidence || !!errors.work}>{busy ? "Đang lưu…" : "Xác nhận"}</button></div>
      <p className="submission-update-note">Lưu ý: Giáo viên có thể chọn “Không hợp lệ” cho bài đã nộp và phải nhập lý do. Nếu giữ trạng thái hiện tại và chỉ nhập lý do hoặc minh chứng, trạng thái nộp bài không thay đổi. Khi có tệp bài làm, hệ thống ghi nhận thời điểm nộp mới; bài nộp sau deadline được tính “Nộp muộn”. Quyết định “Không hợp lệ” đã có vẫn được giữ nguyên.</p>
    </>}
  </form></div>;
}
