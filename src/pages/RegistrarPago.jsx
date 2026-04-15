import React, { useEffect, useMemo, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerOCsAprobadas, registrarLog } from "../firebase/firestoreHelpers";
import { subirArchivoComprobante } from "../firebase/pagosHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { db } from "../firebase/config";
import { runTransaction, doc, collection, serverTimestamp } from "firebase/firestore";

const RegistrarPago = () => {
  const { usuario, loading } = useUsuario();
  const [ocs, setOCs] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ numero: "", fecha: "", monto: "", archivo: null });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (loading) return;
    (async () => {
      // [F-03] Consulta directa en Firestore por estado=Aprobada (no carga todas las OCs)
      const data = await obtenerOCsAprobadas();
      setOCs(data || []);
    })();
  }, [loading]);

  const totalOC = useMemo(() => {
    if (!sel?.items) return 0;
    const sub = sel.items.reduce((acc, it) => acc + (Number(it.precioUnitario) - Number(it.descuento || 0)) * Number(it.cantidad || 0), 0);
    const igv = sub * 0.18;
    const otros = Number(sel?.resumen?.otros || 0);
    return sub + igv + otros;
  }, [sel]);

  const seleccionar = (id) => {
    const o = ocs.find(x => x.id === id);
    setSel(o || null);
    setForm({ numero: "", fecha: "", monto: "", archivo: null });
  };

  const guardar = async () => {
    if (!sel) return;
    if (!form.numero.trim() || !form.fecha || !form.monto) {
      alert("Completa número de factura, fecha y monto.");
      return;
    }
    setGuardando(true);
    try {
      // Subir archivo antes de la transacción (Storage es externo a Firestore)
      let urlAdjunto = null;
      if (form.archivo) {
        urlAdjunto = await subirArchivoComprobante(sel.id, form.archivo);
      }

      // [C-09] Transacción atómica: crear factura + actualizar OC en un solo commit
      await runTransaction(db, async (tx) => {
        const ocRef = doc(db, "ordenesCompra", sel.id);
        const ocSnap = await tx.get(ocRef);
        if (!ocSnap.exists()) throw new Error("OC no encontrada");

        // Crear registro en /facturas dentro de la transacción
        const facturaRef = doc(collection(db, `ordenesCompra/${sel.id}/facturas`));
        tx.set(facturaRef, {
          numero: form.numero.trim(),
          fecha: form.fecha,
          monto: Number(form.monto),
          urlAdjunto: urlAdjunto || null,
          registradoPor: usuario?.email || "",
          tipo: "factura",
          creadaEn: serverTimestamp(),
        });

        // Marcar OC como pagada
        tx.update(ocRef, {
          estado: "Pagado",
          numeroFactura: form.numero.trim(),
          fechaPago: form.fecha,
          montoPagado: Number(form.monto),
          actualizadoEn: new Date().toISOString(),
        });
      });

      await registrarLog({
        accion: "Pago registrado",
        ocId: sel.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `Factura ${form.numero} por ${formatearMoneda(Number(form.monto), sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}`,
      });

      alert("Pago registrado ✅");
      const data = await obtenerOCsAprobadas();
      setOCs(data || []);
      setSel(null);
      setForm({ numero: "", fecha: "", monto: "", archivo: null });
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar el pago.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!usuario || !["admin","finanzas"].includes(usuario.rol)) {
    return <div className="p-6 text-red-600">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Registrar pago</h2>

      <div className="bg-white rounded shadow p-4 mb-6">
        <label className="block text-sm font-medium mb-1">Selecciona OC</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={sel?.id || ""}
          onChange={(e) => seleccionar(e.target.value)}
        >
          <option value="">— Elegir —</option>
          {ocs.map(o => (
            <option key={o.id} value={o.id}>
              {o.numeroOC || o.numero} • {o.proveedor?.razonSocial || "—"}
            </option>
          ))}
        </select>

        {sel && (
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div><b>Proveedor:</b> {sel.proveedor?.razonSocial}</div>
            <div><b>Moneda:</b> {sel.monedaSeleccionada}</div>
            <div><b>Total OC:</b> {formatearMoneda(totalOC, sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}</div>
            <div><b>Estado:</b> {sel.estado}</div>
          </div>
        )}
      </div>

      {sel && (
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold mb-3">Datos de factura / pago</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              className="border rounded px-3 py-2"
              placeholder="N° factura"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              type="number"
              step="0.01"
              placeholder="Monto pagado"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
            />
          </div>

          <div className="mt-3">
            <label className="text-sm underline cursor-pointer">
              Adjuntar comprobante (PDF/JPG/PNG)
              <input type="file" className="hidden" onChange={(e) => setForm({ ...form, archivo: e.target.files[0] })} />
            </label>
            {form.archivo && <div className="text-xs text-gray-600 mt-1">{form.archivo.name}</div>}
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={guardar}
              disabled={guardando}
              className={`px-4 py-2 rounded text-white ${guardando ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}
            >
              {guardando ? "Guardando…" : "Registrar pago"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrarPago;
