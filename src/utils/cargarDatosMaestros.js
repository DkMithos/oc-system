// src/utils/cargarDatosMaestros.js
import * as XLSX from "xlsx";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

// 1. Borrar proveedores existentes
export const borrarTodosLosProveedores = async () => {
  const snapshot = await getDocs(collection(db, "proveedores"));
  for (const documento of snapshot.docs) {
    await deleteDoc(doc(db, "proveedores", documento.id));
  }
  return "Todos los proveedores fueron eliminados correctamente ❌";
};

// 2. Cargar Proveedores desde Excel
export const cargarProveedoresDesdeExcel = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const hoja = workbook.Sheets["Proveedores"];
  if (!hoja) throw new Error("Hoja 'Proveedores' no encontrada");

  const filas = XLSX.utils.sheet_to_json(hoja);

  for (const fila of filas) {
    const proveedor = {
      ruc: String(fila.RUC),
      razonSocial: fila.Nombre || "",
      email: fila.Email || "",
      direccion: fila.Dirección || "",
      telefono: fila.Teléfono || "",
      contacto: fila.Contacto || "",
      bancos: [
        {
          nombre: fila.Banco || "",
          cuenta: fila.NumeroCuenta || "",
          cci: fila.CuentaCCI || "",
          moneda: fila.Moneda || "",
        },
      ],
    };

    await addDoc(collection(db, "proveedores"), proveedor);
  }

  return "Proveedores cargados correctamente ✅";
};

// 3. Cargar Centros de Costo desde Excel
export const cargarCentrosCostoDesdeExcel = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const hoja = workbook.Sheets["CentrosCosto"];
  if (!hoja) throw new Error("Hoja 'CentrosCosto' no encontrada");

  const filas = XLSX.utils.sheet_to_json(hoja);

  for (const fila of filas) {
    await addDoc(collection(db, "centrosCosto"), {
      nombre: fila.Centro_Costo || "",
    });
  }

  return "Centros de Costo cargados correctamente ✅";
};

// 4. Cargar Condiciones de Pago desde Excel
export const cargarCondicionesPagoDesdeExcel = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const hoja = workbook.Sheets["CondicionesPago"];
  if (!hoja) throw new Error("Hoja 'CondicionesPago' no encontrada");

  const filas = XLSX.utils.sheet_to_json(hoja);

  for (const fila of filas) {
    await addDoc(collection(db, "condicionesPago"), {
      nombre: fila.Condicion_Pago || "",
    });
  }

  return "Condiciones de Pago cargadas correctamente ✅";
};


