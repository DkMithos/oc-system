// src/utils/cargarDatosMaestros.js
import * as XLSX from "xlsx";
import { db } from "../firebase/config";
import { collection, addDoc } from "firebase/firestore";

// Función para leer Excel y cargar datos
export const cargarDesdeExcel = async (archivo) => {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      try {
        // CENTROS DE COSTO
        const hojaCentros = workbook.Sheets["Centros de Costo"];
        const centros = XLSX.utils.sheet_to_json(hojaCentros);

        for (let centro of centros) {
          await addDoc(collection(db, "centrosCosto"), { nombre: centro.nombre });
        }

        // CONDICIONES DE PAGO
        const hojaCondiciones = workbook.Sheets["Condiciones de Pago"];
        const condiciones = XLSX.utils.sheet_to_json(hojaCondiciones);

        for (let cond of condiciones) {
          await addDoc(collection(db, "condicionesPago"), { nombre: cond.nombre });
        }

        resolve("Carga exitosa");
      } catch (error) {
        console.error("Error al cargar datos", error);
        reject("Error en la carga");
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(archivo);
  });
};
