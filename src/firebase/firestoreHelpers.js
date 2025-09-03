import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  query,
  orderBy,
  runTransaction,
} from "firebase/firestore";
import { db } from "./config";

const OC_COLLECTION = "ordenesCompra";
const USUARIOS_COLLECTION = "usuarios";
const LOGS_COLLECTION = "logs";
const COTIZACIONES_COLLECTION = "cotizaciones";
const PROVEEDORES_COLLECTION = "proveedores";

/* =========================
 *  USUARIOS
 * ========================= */
export const obtenerUsuarios = async () => {
  const snapshot = await getDocs(collection(db, "usuarios"));

  const usuarios = [];
  snapshot.forEach((docu) => {
    const data = docu.data();
    if (data.email && data.rol) {
      usuarios.push({
        id: docu.id,
        email: data.email,
        rol: data.rol,
        estado: data.estado || "Activo",
      });
    } else {
      console.warn("⚠️ Usuario omitido por datos incompletos:", docu.id, data);
    }
  });

  return usuarios;
};

// ✅ Crear usuario con contraseña
export const guardarUsuario = async ({ email, rol, password }) => {
  if (!email || !rol) throw new Error("El usuario debe tener correo y rol.");

  const userRef = doc(db, "usuarios", email);
  await setDoc(userRef, {
    email,
    rol,
    estado: "Activo",
    password: password || null, // 🔹 guardamos contraseña inicial
    creadoEn: new Date().toISOString(),
  });
};

// ✅ Cambiar contraseña de usuario
export const actualizarPasswordUsuario = async (email, nuevaPassword) => {
  if (!email || !nuevaPassword) throw new Error("Datos incompletos.");
  const ref = doc(db, "usuarios", email);
  await updateDoc(ref, {
    password: nuevaPassword,
    actualizadoEn: new Date().toISOString(),
  });
};


export const eliminarUsuario = async (email) => {
  await deleteDoc(doc(db, USUARIOS_COLLECTION, email));
};

export const actualizarRolUsuario = async (email, nuevoRol) => {
  const ref = doc(db, USUARIOS_COLLECTION, email);
  await updateDoc(ref, { rol: nuevoRol });
};

/* =========================
 *  LOGS
 * ========================= */
export const registrarLog = async ({ accion, ocId, usuario, rol, comentario = "" }) => {
  try {
    await addDoc(collection(db, LOGS_COLLECTION), {
      accion,
      ocId,
      usuario,
      rol,
      comentario,
      fecha: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error registrando log:", error);
  }
};

export const obtenerLogs = async () => {
  const logsRef = collection(db, LOGS_COLLECTION);
  const q = query(logsRef, orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    fecha: d.data().fecha?.toDate().toLocaleString("es-PE") || "",
  }));
};

/* =========================
 *  OCs
 * ========================= */
export const obtenerOCs = async () => {
  const snapshot = await getDocs(collection(db, OC_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const obtenerOCporId = async (id) => {
  const ref = doc(db, OC_COLLECTION, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const actualizarOC = async (id, nuevaData) => {
  const ref = doc(db, OC_COLLECTION, id);
  await updateDoc(ref, nuevaData);
};

/**
 * Lee el correlativo actual y devuelve el siguiente número formateado (sin consumirlo).
 * Si no existe el documento de correlativos, asume último = 414 para que el siguiente sea 415.
 * Devuelve, por ejemplo: "MM-000415"
 */
export const obtenerSiguienteNumeroOC = async () => {
  const correlativoRef = doc(db, "correlativos", "ordenesCompra");
  const snap = await getDoc(correlativoRef);
  const ultimo = snap.exists() ? Number(snap.data().ultimo || 0) : 416;
  const siguiente = ultimo + 1;
  return `MM-${String(siguiente).padStart(6, "0")}`;
};

/**
 * Guarda una OC asignando número correlativo con transacción atómica.
 * Genera: MM-000XYZ y actualiza correlativos/ordenesCompra.ultimo
 * Retorna el id del documento creado.
 */
export const guardarOC = async (ocData) => {
  const correlativoRef = doc(db, "correlativos", "ordenesCompra");

  // Transacción para evitar colisiones de correlativo
  const { id: newId } = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(correlativoRef);
    const ultimo = snap.exists() ? Number(snap.data().ultimo || 0) : 416;
    const siguiente = ultimo + 1;
    const numeroOC = `MM-${String(siguiente).padStart(6, "0")}`;

    // Prepara el doc de la OC con el número asignado
    const ocRef = doc(collection(db, OC_COLLECTION));
    transaction.set(ocRef, { ...ocData, numeroOC });

    // Actualiza el correlativo
    transaction.set(correlativoRef, { ultimo: siguiente }, { merge: true });

    return { id: ocRef.id, numeroOC };
  });

  return newId;
};

/* =========================
 *  COTIZACIONES
 * ========================= */
export const obtenerCotizaciones = async () => {
  const snapshot = await getDocs(collection(db, COTIZACIONES_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/* =========================
 *  PROVEEDORES
 * ========================= */
export const obtenerProveedores = async () => {
  const snapshot = await getDocs(collection(db, PROVEEDORES_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/* =========================
 *  MAESTROS: Centros de Costo / Condiciones de Pago
 * ========================= */
export const obtenerCentrosCosto = async () => {
  const snapshot = await getDocs(collection(db, "centrosCosto"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const guardarCentroCosto = async (centro) => {
  await addDoc(collection(db, "centrosCosto"), centro);
};

export const editarCentroCosto = async (id, nombre) => {
  await updateDoc(doc(db, "centrosCosto", id), { nombre });
};

export const eliminarCentroCosto = async (id) => {
  await deleteDoc(doc(db, "centrosCosto", id));
};

export const guardarCondicionPago = async (condicion) => {
  await addDoc(collection(db, "condicionesPago"), condicion);
};

export const obtenerCondicionesPago = async () => {
  const snapshot = await getDocs(collection(db, "condicionesPago"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const editarCondicionPago = async (id, nombre) => {
  await updateDoc(doc(db, "condicionesPago", id), { nombre });
};

export const eliminarCondicionPago = async (id) => {
  await deleteDoc(doc(db, "condicionesPago", id));
};

/* =========================
 *  FIRMAS
 * ========================= */
export const obtenerFirmaUsuario = async (email) => {
  const docRef = doc(db, "firmas", email);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().firma : null;
};

export const guardarFirmaUsuario = async (email, firmaDataUrl) => {
  const docRef = doc(db, "firmas", email);
  await setDoc(docRef, { firma: firmaDataUrl });
};
