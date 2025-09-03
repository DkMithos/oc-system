// ✅ src/firebase/ticketsHelpers.js
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

const TICKETS = "tickets";

// ⚙️ Admin por defecto (asignación automática)
export const DEFAULT_AGENT = {
  email: "kcastillo@memphis.pe",
  nombre: "Kevin Castillo",
};

// 👉 Crear ticket (NO sube adjuntos aquí)
export const crearTicket = async ({
  asunto,
  descripcion,
  prioridad = "media",
  creadoPor,          // { email, nombre }
  categoria = "otros",
  asignadoA = DEFAULT_AGENT, // { email, nombre }
}) => {
  const creador = {
    email: (creadoPor?.email || "").toLowerCase(),
    nombre: creadoPor?.nombre || creadoPor?.email || "",
  };
  const agente = {
    email: (asignadoA?.email || "").toLowerCase(),
    nombre: asignadoA?.nombre || asignadoA?.email || "",
  };

  const docRef = await addDoc(collection(db, TICKETS), {
    asunto: asunto?.trim(),
    descripcion: descripcion?.trim(),
    categoria,
    prioridad,                  // baja | media | alta | crítica
    estado: "abierto",          // abierto | en_progreso | resuelto | cerrado
    creadoPor: creador,         // normalizado en minúscula
    asignadoA: agente,          // normalizado en minúscula
    adjuntos: [],               // [{url, nombre}]
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// 👉 Subir adjunto (PDF/IMG) y devolver metadata
export const subirAdjuntoTicket = async (file, ticketId) => {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `tickets/${ticketId}/${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, nombre: file.name };
};

// 👉 Anexar adjunto al ticket
export const anexarAdjuntoTicket = async (ticketId, adjunto) => {
  const refTicket = doc(db, TICKETS, ticketId);
  const snap = await getDoc(refTicket);
  const prev = snap.exists() ? (snap.data().adjuntos || []) : [];
  await updateDoc(refTicket, {
    adjuntos: [...prev, adjunto],
    updatedAt: serverTimestamp(),
  });
};

// 👉 Mis tickets (normaliza email)
export const listarMisTickets = async (email) => {
  const q = query(
    collection(db, TICKETS),
    where("creadoPor.email", "==", (email || "").toLowerCase()),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 👉 Admin: todos
export const listarTicketsAdmin = async () => {
  const q = query(collection(db, TICKETS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 👉 Escuchar ticket
export const escucharTicket = (ticketId, cb) => {
  return onSnapshot(doc(db, TICKETS, ticketId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() });
  });
};

// 👉 Cambiar estado
export const cambiarEstadoTicket = async (ticketId, estado) => {
  await updateDoc(doc(db, TICKETS, ticketId), {
    estado,
    updatedAt: serverTimestamp(),
  });
};

// 👉 Asignar a agente
export const asignarTicket = async (ticketId, asignadoA) => {
  await updateDoc(doc(db, TICKETS, ticketId), {
    asignadoA: {
      email: (asignadoA?.email || "").toLowerCase(),
      nombre: asignadoA?.nombre || asignadoA?.email || "",
    },
    estado: "en_progreso",
    updatedAt: serverTimestamp(),
  });
};

// ====== Chat por ticket ======
const mensajesRef = (ticketId) => collection(db, TICKETS, ticketId, "mensajes");

export const enviarMensajeTicket = async (ticketId, { texto, autor }) => {
  await addDoc(mensajesRef(ticketId), {
    texto,
    autor: {
      email: (autor?.email || "").toLowerCase(),
      nombre: autor?.nombre || autor?.email || "",
      rol: autor?.rol || "usuario",
    },
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, TICKETS, ticketId), { updatedAt: serverTimestamp() });
};

export const escucharMensajesTicket = (ticketId, cb) => {
  const q = query(mensajesRef(ticketId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};
