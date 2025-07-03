// src/pages/Historial.jsx
import React, { useEffect, useState } from "react";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { useNavigate } from "react-router-dom";

const Historial = () => {
  const [ordenes, setOrdenes] = useState([]);
  const navigate = useNavigate();
  const userRole = localStorage.getItem("userRole");

  useEffect(() => {
    const cargarOCs = async () => {
      const data = await obtenerOCs();
      setOrdenes(data);
    };
    cargarOCs();
  }, []);

  const puedeFirmar = (oc) => {
    if (userRole === "operaciones" && oc.estado === "Pendiente de Operaciones") return true;
    if (userRole === "gerencia" && oc.estado === "Aprobado por Operaciones") return true;
    return false;
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Historial de Órdenes de Compra</h2>

      {ordenes.length === 0 ? (
        <p className="text-gray-600">No hay órdenes disponibles.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100 text-center">
              <tr>
                <th className="border px-3 py-2">N° OC</th>
                <th className="border px-3 py-2">Proveedor</th>
                <th className="border px-3 py-2">Fecha</th>
                <th className="border px-3 py-2">Estado</th>
                <th className="border px-3 py-2">Factura</th>
                <th className="border px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((oc) => (
                <tr key={oc.id} className="text-center border-t">
                  <td className="border px-3 py-2 font-semibold">{oc.id}</td>
                  <td className="border px-3 py-2">{oc.proveedor?.razonSocial || "—"}</td>
                  <td className="border px-3 py-2">{oc.fechaEmision}</td>
                  <td className="border px-3 py-2">
                    <span
                      className={`font-medium px-2 py-1 rounded-full ${
                        oc.estado === "Pagado"
                          ? "text-green-700 bg-green-100"
                          : oc.estado === "Rechazado"
                          ? "text-red-700 bg-red-100"
                          : oc.estado.includes("Aprobado")
                          ? "text-blue-700 bg-blue-100"
                          : "text-gray-700 bg-gray-100"
                      }`}
                    >
                      {oc.estado}
                    </span>
                  </td>
                  <td className="border px-3 py-2 text-xs">
                    {oc.estado === "Pagado" && oc.numeroFactura
                      ? oc.numeroFactura
                      : "—"}
                  </td>
                  <td className="border px-3 py-2">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => navigate(`/ver?id=${oc.id}`)}
                        className="text-blue-600 underline"
                      >
                        Ver
                      </button>

                      {oc.estado === "Rechazado" && (
                        <button
                          onClick={() => navigate(`/editar?id=${oc.id}`)}
                          className="text-orange-600 underline"
                        >
                          Editar
                        </button>
                      )}

                      {puedeFirmar(oc) && (
                        <button
                          onClick={() => navigate(`/firmar?id=${oc.id}`)}
                          className="text-green-600 underline"
                        >
                          Firmar
                        </button>
                      )}
                    </div>
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

export default Historial;
