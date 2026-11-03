import React, { useRef, useState } from "react";

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={i}>{part.slice(2,-2)}</u>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1,-1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    return link ? <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : part;
  });
}
export function AssignmentDescription({ text }) {
  return <div className="assignment-description">{(text || "Chưa có mô tả.").split("\n").map((line, i) => <div key={i}>{inline(line) || <br />}</div>)}</div>;
}
export default function DescriptionEditor({ value, onChange, label = "Mô tả" }) {
  const input = useRef(null), [preview, setPreview] = useState(false);
  function insert(before, after = "") {
    const field = input.current, start = field.selectionStart, end = field.selectionEnd;
    const selected = value.slice(start, end) || "Nội dung";
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + before.length, start + before.length + selected.length); });
  }
  return <div className="assignment-description-editor"><label>{label}</label><div className="assignment-format-toolbar">
    <button type="button" disabled={preview} aria-label="In đậm" onClick={() => insert("**", "**")}><b>B</b></button><button type="button" disabled={preview} aria-label="In nghiêng" onClick={() => insert("*", "*")}><i>I</i></button><button type="button" disabled={preview} aria-label="Gạch chân" onClick={() => insert("__", "__")}><u>U</u></button><button type="button" disabled={preview} onClick={() => insert("\n• ")}>• Danh sách</button><button type="button" disabled={preview} onClick={() => insert("\n1. ")}>1. Danh sách</button><button type="button" onClick={() => setPreview(!preview)}>{preview ? "Chỉnh sửa" : "Xem trước"}</button>
  </div>{preview ? <AssignmentDescription text={value} /> : <textarea ref={input} aria-label={label} value={value} onChange={e => onChange(e.target.value)} />}</div>;
}
