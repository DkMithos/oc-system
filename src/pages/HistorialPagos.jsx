import React, { useEffect, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { obtenerFacturasDeOrden } from "../firebase/firestoreHelpers";

const HistorialPagos = () => {
  const { usuario, loading } = useUsuario();
  const [pagadas, setPagadas] = useState([]);
  const [abierta, setAbierta] = useState(null);
  const [facturas, setFacturas] = useState([]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const data = await obtenerOCs();
      setPagadas((data || []).filter(o => o.estado === "Pagado"));
    })();
  }, [loading]);

  const verFacturas = async (oc) => {
    setAbierta(oc);
    const f = await obtenerFacturasDeOrden(oc.id);
    setFacturas(f);
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!usuario || !["admin","finanzas"].includes(usuario.rol)) {
    return <div className="p-6 text-red-600">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Historial de pagos</h2>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">N° OC</th>
              <th className="p-2 text-left">Proveedor</th>
              <th className="p-2 text-left">Factura</th>
              <th className="p-2 text-left">Fecha Pago</th>
              <th className="p-2 text-left">Monto Pagado</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagadas.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No hay pagos registrados.</td></tr>
            ) : pagadas.map(o => (
              <tr key={o.id} className="border-t">
                <td className="p-2">{o.numeroOC || o.numero}</td>
                <td className="p-2">{o.proveedor?.razonSocial || "—"}</td>
                <td className="p-2">{o.numeroFactura || "—"}</td>
                <td className="p-2">{o.fechaPago || "—"}</td>
                <td className="p-2">{o.montoPagado != null ? o.montoPagado : "—"}</td>
                <td className="p-2">
                  <button className="text-blue-700 underline" onClick={() => verFacturas(o)}>Ver adjuntos</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {abierta && (
        <div className="mt-4 bg-white rounded shadow p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">
              Adjuntos de {abierta.numeroOC || abierta.numero} — {abierta.proveedor?.razonSocial}
            </h3>
            <button className="text-sm px-2 py-1 bg-gray-100 rounded" onClick={() => setAbierta(null)}>Cerrar</button>
          </div>
          {facturas.length === 0 ? (
            <div className="text-sm text-gray-500 mt-2">Esta OC no tiene adjuntos.</div>
          ) : (
            <ul className="list-disc ml-5 mt-2">
              {facturas.map(f => (
                <li key={f.id} className="text-sm">
                  <b>{f.numero || "Factura"}</b> {f.fecha ? `• ${f.fecha}` : ""} {f.monto ? `• ${f.monto}` : ""}
                  {f.urlAdjunto && (
                    <> • <a className="text-blue-700 underline" href={f.urlAdjunto} target="_blank" rel="noreferrer">Ver archivo</a></>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default HistorialPagos;
