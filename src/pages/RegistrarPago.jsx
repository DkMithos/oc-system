// src/pages/RegistrarPago.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useUsuario } from "../context/UsuarioContext";
import {
  obtenerOCs,
  actualizarOC,
  registrarLog,
  agregarFacturaAOrden,
} from "../firebase/firestoreHelpers";
import { notificarUsuario } from "../firebase/notifs";
import { subirArchivoComprobante } from "../firebase/pagosHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";

// ── Tipos de pago soportados ───────────────────────────────────
const TIPOS_PAGO = ["Transferencia", "Cheque", "Efectivo", "Depósito", "Otro"];

// ── Detracción: aplica si monto >= 700 PEN (SUNAT) ────────────
const calcularDetraccion = (oc) => {
  if (!oc) return { aplica: false, tasa: 0, monto: 0 };
  const total   = oc.resumen?.total ?? 0;
  const moneda  = oc.monedaSeleccionada || "Soles";
  // Detracción solo en Soles y >= S/ 700 (simplificación)
  if (moneda !== "Soles" || total < 700) return { aplica: false, tasa: 0, monto: 0 };
  // Tasa general 12% (personalizable según tipo de servicio)
  const tasa = 12;
  const monto = Math.round(total * (tasa / 100) * 100) / 100;
  return { aplica: true, tasa, monto };
};

// ──────────────────────────────────────────────────────────────
const RegistrarPago = () => {
  const { usuario, cargando: loading } = useUsuario();

  const [ocs, setOCs]           = useState([]);
  const [sel, setSel]           = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm]         = useState({
    numero:    "",
    fecha:     new Date().toISOString().split("T")[0],
    monto:     "",
    tipoPago:  "Transferencia",
    notas:     "",
    archivo:   null,
    aplicaDetraccion: false,
  });

  const cargarOCs = async () => {
    const data = await obtenerOCs(200);
    // Solo OCs aprobadas (estado correcto) y no pagadas
    setOCs((data || []).filter((o) => o.estado === "Aprobada"));
  };

  useEffect(() => {
    if (loading) return;
    cargarOCs();
  }, [loading]);

  const seleccionar = (id) => {
    const o = ocs.find((x) => x.id === id);
    setSel(o || null);
    const det = calcularDetraccion(o);
    setForm({
      numero:    "",
      fecha:     new Date().toISOString().split("T")[0],
      monto:     o?.resumen?.total?.toFixed(2) || "",
      tipoPago:  "Transferencia",
      notas:     "",
      archivo:   null,
      aplicaDetraccion: det.aplica,
    });
  };

  const detraccion = useMemo(() => calcularDetraccion(sel), [sel]);
  const montoNeto  = useMemo(() => {
    const m = Number(form.monto || 0);
    return form.aplicaDetraccion ? Math.max(0, m - detraccion.monto) : m;
  }, [form.monto, form.aplicaDetraccion, detraccion.monto]);

  const guardar = async () => {
    if (!sel) return;

    if (!form.numero.trim()) return toast.warning("Ingresa el N° de factura.");
    if (!form.fecha)         return toast.warning("Ingresa la fecha de pago.");
    if (!form.monto || Number(form.monto) <= 0) return toast.warning("Ingresa un monto válido.");
    const totalOC = sel?.resumen?.total || 0;
    if (totalOC > 0 && Number(form.monto) > totalOC * 1.01) {
      // Permite hasta 1% de diferencia por redondeo
      return toast.warning(`El monto (${form.monto}) no puede exceder el total de la OC (${totalOC.toFixed(2)}).`);
    }

    setGuardando(true);
    try {
      let urlAdjunto = null;
      if (form.archivo) {
        urlAdjunto = await subirArchivoComprobante(sel.id, form.archivo);
      }

      // 1) Registrar factura en subcolección
      await agregarFacturaAOrden(sel.id, {
        numero:    form.numero.trim(),
        fecha:     form.fecha,
        monto:     Number(form.monto),
        montoNeto,
        tipoPago:  form.tipoPago,
        detraccion: form.aplicaDetraccion ? detraccion : null,
        notas:     form.notas || "",
        urlAdjunto: urlAdjunto || null,
        registradoPor: usuario?.email || "",
        tipo: "factura",
      });

      // 2) Actualizar OC — estado "Pagado" + snapshot de pago
      await actualizarOC(sel.id, {
        estado:        "Pagado",
        numeroFactura: form.numero.trim(),
        fechaPago:     form.fecha,
        montoPagado:   Number(form.monto),
        montoNeto,
        tipoPago:      form.tipoPago,
        detraccion:    form.aplicaDetraccion ? detraccion : null,
        historial: [
          ...(sel.historial || []),
          {
            accion: "Pago registrado",
            por:    usuario?.email || "",
            rol:    usuario?.rol   || "",
            monto:  Number(form.monto),
            tipoPago: form.tipoPago,
            fecha:  new Date().toLocaleString("es-PE"),
          },
        ],
      });

      // 3) Log
      await registrarLog({
        accion:     "pago_registrado",
        ocId:       sel.id,
        usuario:    usuario?.email,
        rol:        usuario?.rol,
        comentario: `Factura ${form.numero} por ${formatearMoneda(Number(form.monto), sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}`,
      });

      // 4) Notificar al creador de la OC
      notificarUsuario({
        email: sel.creadoPor || "",
        title: "OC Pagada 💰",
        body:  `La OC ${sel.numero} ha sido registrada como pagada.`,
        ocId:  sel.id,
      }).catch(() => {});

      toast.success("Pago registrado correctamente ✅");
      await cargarOCs();
      setSel(null);
      setForm({ numero: "", fecha: new Date().toISOString().split("T")[0], monto: "", tipoPago: "Transferencia", notas: "", archivo: null, aplicaDetraccion: false });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo registrar el pago.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!usuario || !["admin", "finanzas"].includes(usuario.rol)) {
    return <div className="p-6 text-red-600">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Registrar pago</h2>

      {/* Selector de OC */}
      <div className="bg-white rounded shadow p-4 mb-5">
        <label className="block text-sm font-medium mb-1">Selecciona OC aprobada</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={sel?.id || ""}
          onChange={(e) => seleccionar(e.target.value)}
        >
          <option value="">— Elegir OC —</option>
          {ocs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.numeroOC || o.numero} • {o.proveedor?.razonSocial || "—"} •{" "}
              {formatearMoneda(o.resumen?.total || 0, o.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}
            </option>
          ))}
        </select>

        {ocs.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            No hay OCs con estado "Aprobada" disponibles para pago.
          </p>
        )}

        {sel && (
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm bg-blue-50 rounded p-3">
            <div><b>Proveedor:</b> {sel.proveedor?.razonSocial}</div>
            <div><b>RUC:</b> {sel.proveedor?.ruc || "—"}</div>
            <div><b>Moneda:</b> {sel.monedaSeleccionada || "Soles"}</div>
            <div><b>Subtotal:</b> {formatearMoneda(sel.resumen?.subtotal || 0, sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}</div>
            <div><b>IGV ({sel.resumen?.igvTasa ?? 18}%):</b> {formatearMoneda(sel.resumen?.igv || 0, sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}</div>
            <div><b>Total OC:</b> <span className="font-bold">{formatearMoneda(sel.resumen?.total || 0, sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}</span></div>
            <div><b>Banco:</b> {sel.bancoSeleccionado || "—"}</div>
            <div><b>Cuenta:</b> {sel.cuenta?.cuenta || "—"}</div>
            <div><b>CCI:</b> {sel.cuenta?.cci || "—"}</div>
          </div>
        )}
      </div>

      {/* Formulario de pago */}
      {sel && (
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold mb-4">Datos de pago</h3>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">N° Factura / Comprobante</label>
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="F001-00123456"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de Pago</label>
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Pago</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={form.tipoPago}
                onChange={(e) => setForm({ ...form, tipoPago: e.target.value })}
              >
                {TIPOS_PAGO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Monto pagado</label>
              <input
                type="number"
                step="0.01"
                className="border rounded px-3 py-2 w-full text-right"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>

            {/* Detracción */}
            {detraccion.aplica && (
              <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.aplicaDetraccion}
                    onChange={(e) => setForm({ ...form, aplicaDetraccion: e.target.checked })}
                  />
                  <span>
                    Aplicar detracción {detraccion.tasa}% — SUNAT ({" "}
                    {formatearMoneda(detraccion.monto, "Soles")})
                  </span>
                </label>
                {form.aplicaDetraccion && (
                  <p className="text-xs text-amber-700 mt-1">
                    Monto neto a transferir al proveedor:{" "}
                    <b>{formatearMoneda(montoNeto, "Soles")}</b>
                  </p>
                )}
              </div>
            )}

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
              <textarea
                className="border rounded px-3 py-2 w-full text-sm"
                rows={2}
                value={form.notas}
                placeholder="Observaciones del pago..."
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">
                Adjuntar comprobante (PDF / JPG / PNG)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setForm({ ...form, archivo: e.target.files?.[0] || null })}
                className="block"
              />
              {form.archivo && (
                <p className="text-xs text-gray-600 mt-1">{form.archivo.name}</p>
              )}
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-4 border-t pt-3 flex items-center justify-between">
            <div className="text-sm space-y-1">
              <p>Monto a pagar: <b>{formatearMoneda(Number(form.monto || 0), sel.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}</b></p>
              {form.aplicaDetraccion && (
                <p className="text-amber-700">
                  Detracción ({detraccion.tasa}%): <b>− {formatearMoneda(detraccion.monto, "Soles")}</b>
                  <br />
                  Neto al proveedor: <b>{formatearMoneda(montoNeto, "Soles")}</b>
                </p>
              )}
            </div>
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-5 py-2 rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 font-semibold"
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
