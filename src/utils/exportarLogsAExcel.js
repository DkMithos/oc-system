import * as XLSX from "xlsx";

export const exportarLogsAExcel = (logs) => {
  const datos = logs.map((log) => ({
    Fecha: log.fecha,
    Acción: log.accion,
    Usuario: log.usuario,
    Rol: log.rol,
    "OC ID": log.ocId,
    Comentario: log.comentario || "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Logs");

  XLSX.writeFile(libro, `logs_sistema_${new Date().toISOString().split("T")[0]}.xlsx`);
};
