let csrf = "";
function formatError(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatError).join(" ");
  if (value && typeof value === "object")
    return value.message || Object.values(value).map(formatError).join(" ");
  return "Không thể thực hiện thao tác.";
}
export async function api(path, body, method) {
  const response = await fetch("/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers:
      body instanceof FormData
        ? { "X-CSRFToken": csrf }
        : { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const d = await response
    .json()
    .catch(() => ({ error: "Máy chủ không trả về dữ liệu hợp lệ." }));
  if (!response.ok) throw new Error(formatError(d.error));
  if (d.csrf) csrf = d.csrf;
  return d;
}
