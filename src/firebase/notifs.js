// ✅ src/firebase/notifs.js
const API = import.meta.env.VITE_NOTIFS_ENDPOINT; 
// p.ej. VITE_NOTIFS_ENDPOINT="https://<tu-función>/sendNotification"

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

// Notifica a un usuario (por email)
export const notificarUsuario = async ({ email, title, body, ocId }) =>
  postJSON(API, { toEmail: email, title, body, ocId });

// Notifica a TODOS los usuarios de un rol
export const notificarRol = async ({ rol, title, body, ocId }) =>
  postJSON(API, { toRole: rol, title, body, ocId });
