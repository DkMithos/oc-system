import React, { useEffect, useState } from "react";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { useNavigate } from "react-router-dom";

const HistorialPagos = () => {
  const [ordenes, setOrdenes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarOCsConPagos = async () => {
      const data = await obtenerOCs();
      const conPago = data.filter(
        (oc) => oc.estado === "Pagado" && oc.archivosPago?.length > 0
      );
      setOrdenes(conPago);
    };

    cargarOCsConPagos();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Historial de Pagos</h2>

      {ordenes.length === 0 ? (
        <p className="text-gray-500">No hay pagos registrados aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border mt-4">
            <thead className="bg-gray-100">
              <tr className="text-left">
                <th className="border px-2 py-1">N° OC</th>
                <th className="border px-2 py-1">Proveedor</th>
                <th className="border px-2 py-1">Factura</th>
                <th className="border px-2 py-1">Comprobante</th>
                <th className="border px-2 py-1">F. Emisión</th>
                <th className="border px-2 py-1">F. Pago</th>
                <th className="border px-2 py-1">Monto Pagado</th>
                <th className="border px-2 py-1">Archivos</th>
                <th className="border px-2 py-1">Acción</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((oc) => (
                <tr key={oc.id} className="border-t text-center">
                  <td className="border px-2 py-1 font-semibold">{oc.id}</td>
                  <td className="border px-2 py-1">{oc.proveedor?.razonSocial || "-"}</td>
                  <td className="border px-2 py-1">{oc.numeroFactura || "-"}</td>
                  <td className="border px-2 py-1">{oc.numeroComprobante || "-"}</td>
                  <td className="border px-2 py-1">{oc.fechaEmision}</td>
                  <td className="border px-2 py-1">{oc.fechaPago || "-"}</td>
                  <td className="border px-2 py-1 text-green-700">
                    {oc.monedaSeleccionada === "Dólares" ? "$" : "S/"}{" "}
                    {oc.montoPagado?.toFixed(2)}
                  </td>
                  <td className="border px-2 py-1">
                    <ul className="list-disc pl-4 text-left text-blue-600">
                      {oc.archivosPago?.map((archivo, i) => (
                        <li key={i}>
                          <a
                            href={archivo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {archivo.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="border px-2 py-1">
                    <button
                      onClick={() => navigate(`/ver?id=${oc.id}`)}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      Ver OC
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HistorialPagos;
