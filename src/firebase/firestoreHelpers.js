import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  setDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "./config";

const OC_COLLECTION = "ordenesCompra";
const USUARIOS_COLLECTION = "usuarios";
const LOGS_COLLECTION = "logs";
const COTIZACIONES_COLLECTION = "cotizaciones";
const PROVEEDORES_COLLECTION = "proveedores";

// ✅ Usuarios
export const obtenerUsuarios = async () => {
  const snapshot = await getDocs(collection(db, "usuarios"));

  const usuarios = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Validación: solo incluye usuarios con email y rol definidos
    if (data.email && data.rol) {
      usuarios.push({
        id: doc.id,
        email: data.email,
        rol: data.rol,
        estado: data.estado || "Activo", // default si no existe
      });
    } else {
      console.warn("⚠️ Usuario omitido por datos incompletos:", doc.id, data);
    }
  });

  return usuarios;
};

export const guardarUsuario = async ({ email, rol }) => {
  if (!email || !rol) {
    throw new Error("El usuario debe tener correo y rol.");
  }

  const userRef = doc(db, "usuarios", email);
  await setDoc(userRef, {
    email,
    rol,
    estado: "Activo",
  });
};

export const eliminarUsuario = async (email) => {
  await deleteDoc(doc(db, USUARIOS_COLLECTION, email));
};

export const actualizarRolUsuario = async (email, nuevoRol) => {
  const ref = doc(db, USUARIOS_COLLECTION, email);
  await updateDoc(ref, { rol: nuevoRol });
};

// ✅ Logs
export const registrarLog = async ({ accion, ocId, usuario, rol, comentario = "" }) => {
  try {
    await addDoc(collection(db, "logs"), {
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
  const logsRef = collection(db, "logs");
  const q = query(logsRef, orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    fecha: doc.data().fecha?.toDate().toLocaleString("es-PE") || "",
  }));
};


export const obtenerOCs = async () => {
  const snapshot = await getDocs(collection(db, OC_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

// ✅ Cotizaciones
export const obtenerCotizaciones = async () => {
  const snapshot = await getDocs(collection(db, COTIZACIONES_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ Proveedores
export const obtenerProveedores = async () => {
  const snapshot = await getDocs(collection(db, "proveedores"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Obtener centros de costo
export const obtenerCentrosCosto = async () => {
  const snapshot = await getDocs(collection(db, "centrosCosto"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Guardar nuevo centro de costo
export const guardarCentroCosto = async (centro) => {
  await addDoc(collection(db, "centrosCosto"), centro);
};

// Editar centro de costo
export const editarCentroCosto = async (id, nombre) => {
  await updateDoc(doc(db, "centrosCosto", id), { nombre });
};

// Eliminar centro de costo
export const eliminarCentroCosto = async (id) => {
  await deleteDoc(doc(db, "centrosCosto", id));
};

// Guardar nueva condición de pago
export const guardarCondicionPago = async (condicion) => {
  await addDoc(collection(db, "condicionesPago"), condicion);
};

// Obtener condiciones de pago
export const obtenerCondicionesPago = async () => {
  const snapshot = await getDocs(collection(db, "condicionesPago"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Editar condiciones de pago
export const editarCondicionPago = async (id, nombre) => {
  await updateDoc(doc(db, "condicionesPago", id), { nombre });
};

// Eliminar condición de pago
export const eliminarCondicionPago = async (id) => {
  await deleteDoc(doc(db, "condicionesPago", id));
};

// Genera el número correlativo y guarda la OC
export const guardarOC = async (ocData) => {
  const correlativoRef = doc(db, "correlativos", "ordenesCompra");
  const correlativoSnap = await getDoc(correlativoRef);

  let nuevoNumero = 415;

  if (correlativoSnap.exists()) {
    const data = correlativoSnap.data();
    nuevoNumero = (data.ultimo || 414) + 1;
  }

  // Formato final
  const numeroOC = `MM-${String(nuevoNumero).padStart(6, "0")}`;

  const nuevaOC = {
    ...ocData,
    numeroOC,
  };

  const docRef = await addDoc(collection(db, "ordenesCompra"), nuevaOC);

  // Actualiza el último número usado
  await setDoc(correlativoRef, { ultimo: nuevoNumero }, { merge: true });

  return docRef.id;
};

export const obtenerFirmaUsuario = async (email) => {
  const docRef = doc(db, "firmas", email);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().firma : null;
};

export const guardarFirmaUsuario = async (email, firmaDataUrl) => {
  const docRef = doc(db, "firmas", email);
  await setDoc(docRef, { firma: firmaDataUrl });
};
