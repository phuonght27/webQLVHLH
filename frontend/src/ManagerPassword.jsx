import React, { useState } from "react";
import { api } from "./api";

export default function ManagerPassword({ user, done, notify }) {
  const [mode, setMode] = useState("password"), [visible, show] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError("");
    const payload = Object.fromEntries(new FormData(e.target));
    if (mode !== "forgot" && payload.password !== payload.confirm_password) { setError("Xác nhận mật khẩu mới không khớp."); return; }
    if (mode === "password" && payload.old_password === payload.password) { setError("Mật khẩu mới không được trùng mật khẩu hiện tại."); return; }
    setBusy(true);
    try {
      if (mode === "forgot") { await api("auth/forgot/", { email: user.email }); setMode("reset"); notify("Nếu email hợp lệ, mã xác thực đã được gửi."); }
      else { await api(`auth/${mode === "password" ? "password" : "reset"}/`, { ...payload, email: user.email }); notify("Đã cập nhật mật khẩu. Vui lòng đăng nhập lại."); done(); }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function passwordField(name, label, minLength) {
    return <label><span>{label} <em>*</em></span><div className="password"><input aria-label={label} name={name} required minLength={minLength} maxLength={255} autoComplete={name === "old_password" ? "current-password" : "new-password"} type={visible[name] ? "text" : "password"} /><button type="button" aria-label={`Hiện hoặc ẩn ${label.toLowerCase()}`} onClick={() => show(p => ({ ...p, [name]: !p[name] }))}>◉</button></div></label>;
  }
  return <form className="cm-password-form" onSubmit={submit}>
    <h2>{mode === "password" ? "Đổi mật khẩu" : mode === "forgot" ? "Quên mật khẩu hiện tại" : "Đặt lại mật khẩu"}</h2>
    {error && <div className="alert" role="alert">{error}</div>}
    {mode === "password" ? <>{passwordField("old_password", "Mật khẩu hiện tại")}<button className="link cm-forgot" type="button" onClick={() => { setMode("forgot"); setError(""); }}>Quên mật khẩu hiện tại?</button></> : <label>Email<input readOnly value={user.email} /></label>}
    {mode === "reset" && <label>Mã xác thực<input name="code" required pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" /></label>}
    {mode !== "forgot" && <>{passwordField("password", "Mật khẩu mới", 10)}{passwordField("confirm_password", "Xác nhận mật khẩu mới", 10)}<p className="cm-muted">Mật khẩu mới ít nhất 10 ký tự. Sau khi đổi mật khẩu, các phiên đăng nhập hiện có sẽ được kết thúc.</p></>}
    <div className="cm-footer">{mode !== "password" && <button type="button" disabled={busy} onClick={() => { setMode("password"); setError(""); }}>Quay lại</button>}<button className="primary" disabled={busy}>{busy ? "Đang xử lý…" : mode === "forgot" ? "Gửi mã xác thực" : "Cập nhật"}</button></div>
  </form>;
}
