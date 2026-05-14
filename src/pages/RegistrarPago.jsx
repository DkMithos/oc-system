import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerOCsPendientesPago, registrarLog } from "../firebase/firestoreHelpers";
import { subirArchivoComprobante } from "../firebase/pagosHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { db } from "../firebase/config";
import { runTransaction, doc, collection, serverTimestamp } from "firebase/firestore";
import {
  Search, X, FileText, CreditCard, DollarSign, CheckCircle,
  Clock, Paperclip, Upload, Download, AlertCircle, Layers,
} from "lucide-react";

const TIPOS_PAGO = ["Transferencia bancaria", "Cheque", "Efectivo", "Depósito", "Otro"];
const TIPOS_COMPROBANTE = ["Factura", "Boleta", "Recibo", "Nota de débito", "Otro"];

// ─────────────────────────────────────────────────────────────
// Carga masiva — helpers
// ─────────────────────────────────────────────────────────────

const COLS_PLANTILLA = [
  "N° OC", "Tipo Comprobante", "N° Comprobante",
  "Fecha (YYYY-MM-DD)", "Tipo Pago", "Monto",
  "Tipo de Cambio (solo USD)", "Observaciones",
];

const COLS_ALIAS = {
  "N° OC": ["n° oc", "nro oc", "numero oc", "n_oc", "nro_oc"],
  "Tipo Comprobante": ["tipo comprobante", "tipo_comprobante", "tipocomprobante"],
  "N° Comprobante": ["n° comprobante", "nro comprobante", "numero comprobante", "n_comprobante", "nro_comprobante"],
  "Fecha (YYYY-MM-DD)": ["fecha (yyyy-mm-dd)", "fecha", "date"],
  "Tipo Pago": ["tipo pago", "tipo_pago", "tipopago"],
  "Monto": ["monto", "amount", "importe"],
  "Tipo de Cambio (solo USD)": ["tipo de cambio (solo usd)", "tipo de cambio", "tipo_cambio", "tc", "exchange_rate"],
  "Observaciones": ["observaciones", "obs", "notas", "notes"],
};

function resolveCol(row, colName) {
  const aliases = COLS_ALIAS[colName] || [colName.toLowerCase()];
  for (const key of Object.keys(row)) {
    if (aliases.includes(key.toLowerCase().trim())) return row[key];
  }
  return "";
}

function parsearFila(raw, ocs, idx) {
  const nroOC = String(resolveCol(raw, "N° OC") || "").trim();
  const tipoComprobante = String(resolveCol(raw, "Tipo Comprobante") || "Factura").trim();
  const nroComprobante = String(resolveCol(raw, "N° Comprobante") || "").trim();
  const fechaRaw = resolveCol(raw, "Fecha (YYYY-MM-DD)");
  const fecha = typeof fechaRaw === "number"
    ? XLSX.SSF.format("yyyy-mm-dd", fechaRaw)
    : String(fechaRaw || "").trim();
  const tipoPago = String(resolveCol(raw, "Tipo Pago") || "Transferencia bancaria").trim();
  const monto = Number(resolveCol(raw, "Monto") || 0);
  const tipoCambio = Number(resolveCol(raw, "Tipo de Cambio (solo USD)") || 0);
  const observaciones = String(resolveCol(raw, "Observaciones") || "").trim();

  const oc = ocs.find((o) => {
    const num = (o.numeroOC || o.numero || "").trim().toLowerCase();
    return num === nroOC.toLowerCase();
  });

  const errores = [];
  if (!nroOC) errores.push("N° OC requerido");
  else if (!oc) errores.push(`OC "${nroOC}" no encontrada o no está pendiente de pago`);
  if (!nroComprobante) errores.push("N° comprobante requerido");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.push("Fecha inválida — use YYYY-MM-DD");
  if (!monto || monto <= 0) errores.push("Monto inválido");
  if (oc) {
    const saldoOC = Math.max(0, Number(oc.resumen?.total || 0) - Number(oc.montoPagado || 0));
    if (monto > saldoOC + 0.01) {
      errores.push(`Monto (${monto.toFixed(2)}) excede saldo pendiente (${saldoOC.toFixed(2)})`);
    }
    if (oc.monedaSeleccionada === "Dólares" && (!tipoCambio || tipoCambio <= 0)) {
      errores.push("Tipo de cambio requerido para OC en dólares");
    }
  }

  return {
    fila: idx + 2,
    nroOC, tipoComprobante, nroComprobante, fecha, tipoPago, monto, tipoCambio, observaciones,
    oc,
    errores,
    valido: errores.length === 0,
  };
}

// ─────────────────────────────────────────────────────────────
const RegistrarPago = () => {
  const { usuario, cargando: loadingAuth } = useUsuario();
  const [ocs, setOCs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState("individual"); // "individual" | "masivo"

  // ── individual ──
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState(null);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const busquedaRef = useRef(null);
  const [form, setForm] = useState({
    tipoComprobante: "Factura",
    numero: "",
    fecha: "",
    tipoPago: "Transferencia bancaria",
    monto: "",
    tipoCambio: "",
    observaciones: "",
    archivo: null,
  });

  // ── masivo ──
  const fileInputRef = useRef(null);
  const [filasMasivas, setFilasMasivas] = useState([]);
  const [procesandoMasivo, setProcesandoMasivo] = useState(false);
  const [resultadosMasivos, setResultadosMasivos] = useState(null);

  useEffect(() => {
    if (loadingAuth) return;
    (async () => {
      try {
        const data = await obtenerOCsPendientesPago();
        setOCs(data || []);
      } catch (e) {
        console.error("Error cargando OCs pendientes:", e);
        toast.error("No se pudieron cargar las órdenes. Verifica tu conexión.");
      } finally {
        setCargando(false);
      }
    })();
  }, [loadingAuth]);

  // ── individual: filtrado ──
  const ocsFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ocs;
    return ocs.filter((o) => {
      const num = (o.numeroOC || o.numero || "").toLowerCase();
      const prov = (o.proveedor?.razonSocial || "").toLowerCase();
      const ruc = (o.proveedor?.ruc || "").toLowerCase();
      return num.includes(q) || prov.includes(q) || ruc.includes(q);
    });
  }, [ocs, busqueda]);

  const seleccionar = (oc) => {
    setSel(oc);
    setBusqueda(oc.numeroOC || oc.numero || "");
    setMostrarLista(false);
    setForm({ tipoComprobante: "Factura", numero: "", fecha: "", tipoPago: "Transferencia bancaria", monto: "", tipoCambio: "", observaciones: "", archivo: null });
  };

  const limpiar = () => {
    setSel(null);
    setBusqueda("");
    setForm({ tipoComprobante: "Factura", numero: "", fecha: "", tipoPago: "Transferencia bancaria", monto: "", tipoCambio: "", observaciones: "", archivo: null });
  };

  // ── individual: cálculos ──
  const totalOC      = useMemo(() => Number(sel?.resumen?.total || 0), [sel]);
  const montoPagadoPrev = useMemo(() => Number(sel?.montoPagado || 0), [sel]);
  const saldo        = useMemo(() => Math.max(0, totalOC - montoPagadoPrev), [totalOC, montoPagadoPrev]);
  const montoForm    = useMemo(() => Math.max(0, Number(form.monto) || 0), [form.monto]);
  const nuevoMontoPagado = useMemo(() => montoPagadoPrev + montoForm, [montoPagadoPrev, montoForm]);
  const nuevoSaldo   = useMemo(() => Math.max(0, totalOC - nuevoMontoPagado), [totalOC, nuevoMontoPagado]);
  const estadoResultante = useMemo(() => {
    if (!sel || montoForm === 0) return null;
    return nuevoSaldo <= 0.01 ? "Pagado" : "Pago Parcial";
  }, [sel, montoForm, nuevoSaldo]);
  const esDolares = sel?.monedaSeleccionada === "Dólares";
  const moneda = esDolares ? "Dólares" : "Soles";

  // ── individual: guardar ──
  const guardar = async () => {
    if (!sel) return;
    if (!form.numero.trim()) { toast.error("Ingresa el número de comprobante."); return; }
    if (!form.fecha) { toast.error("Selecciona la fecha del comprobante."); return; }
    if (!form.monto || montoForm <= 0) { toast.error("Ingresa un monto válido."); return; }
    if (montoForm > saldo + 0.01) { toast.error(`El monto excede el saldo pendiente (${formatearMoneda(saldo, moneda)}).`); return; }
    if (esDolares && (!form.tipoCambio || Number(form.tipoCambio) <= 0)) { toast.error("Ingresa el tipo de cambio para OC en dólares."); return; }

    setGuardando(true);
    try {
      let urlAdjunto = null;
      if (form.archivo) urlAdjunto = await subirArchivoComprobante(sel.id, form.archivo);

      await runTransaction(db, async (tx) => {
        const ocRef = doc(db, "ordenesCompra", sel.id);
        const ocSnap = await tx.get(ocRef);
        if (!ocSnap.exists()) throw new Error("OC no encontrada");
        const ocData = ocSnap.data();
        const pagadoActual = Number(ocData.montoPagado || 0);
        const totalOCTx   = Number(ocData.resumen?.total || 0);
        const nuevoTotal  = pagadoActual + montoForm;
        if (nuevoTotal > totalOCTx + 0.01) throw new Error("El monto excede el saldo pendiente");
        const saldoFinal  = Math.max(0, totalOCTx - nuevoTotal);
        const estadoFinal = saldoFinal <= 0.01 ? "Pagado" : "Pago Parcial";

        const facturaRef = doc(collection(db, `ordenesCompra/${sel.id}/facturas`));
        tx.set(facturaRef, {
          tipoComprobante: form.tipoComprobante,
          numero: form.numero.trim(),
          fecha: form.fecha,
          tipoPago: form.tipoPago,
          monto: montoForm,
          tipoCambio: esDolares ? Number(form.tipoCambio) : null,
          observaciones: form.observaciones.trim() || null,
          urlAdjunto: urlAdjunto || null,
          registradoPor: usuario?.email || "",
          creadaEn: serverTimestamp(),
        });
        tx.update(ocRef, {
          estado: estadoFinal,
          montoPagado: nuevoTotal,
          montoPendiente: saldoFinal,
          fechaPago: form.fecha,
          actualizadoEn: new Date().toISOString(),
        });
      });

      await registrarLog({
        accion: "Pago registrado",
        ocId: sel.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `${form.tipoComprobante} ${form.numero} · ${formatearMoneda(montoForm, moneda)} · ${estadoResultante}`,
      });

      toast.success(`Pago registrado. Estado: ${estadoResultante} ✓`);
      const data = await obtenerOCsPendientesPago();
      setOCs(data || []);
      limpiar();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo registrar el pago: " + (e.message || ""));
    } finally {
      setGuardando(false);
    }
  };

  // ── masivo: plantilla ──
  const descargarPlantilla = () => {
    const ejemplo = [
      {
        "N° OC": "OC-2024-001",
        "Tipo Comprobante": "Factura",
        "N° Comprobante": "F001-00123",
        "Fecha (YYYY-MM-DD)": "2024-05-01",
        "Tipo Pago": "Transferencia bancaria",
        "Monto": 1000.00,
        "Tipo de Cambio (solo USD)": "",
        "Observaciones": "",
      },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(ejemplo, { header: COLS_PLANTILLA });
    // Column widths
    ws["!cols"] = COLS_PLANTILLA.map((c) => ({ wch: Math.max(c.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    XLSX.writeFile(wb, "plantilla_pagos_masivos.xlsx");
  };

  // ── masivo: parsear archivo ──
  const onArchivoMasivo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rawRows.length === 0) { toast.error("El archivo está vacío."); return; }
        const filas = rawRows
          .map((r, i) => parsearFila(r, ocs, i))
          .filter((f) => f.nroOC); // omit blank rows
        setFilasMasivas(filas);
        setResultadosMasivos(null);
      } catch (err) {
        console.error(err);
        toast.error("Error al leer el archivo. Verifica el formato.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── masivo: procesar (paralelizado en chunks de 5) ──
  const procesarPagosMasivos = async () => {
    const validas = filasMasivas.filter((f) => f.valido);
    if (validas.length === 0) return;
    setProcesandoMasivo(true);
    const resultados = [];
    const CHUNK_SIZE = 5;

    // Helper: procesar una fila individual
    const procesarFila = async (fila) => {
      const { oc, tipoComprobante, nroComprobante, fecha, tipoPago, monto, tipoCambio, observaciones } = fila;
      const esDol = oc.monedaSeleccionada === "Dólares";

      await runTransaction(db, async (tx) => {
        const ocRef = doc(db, "ordenesCompra", oc.id);
        const ocSnap = await tx.get(ocRef);
        if (!ocSnap.exists()) throw new Error("OC no encontrada");
        const ocData = ocSnap.data();
        const pagadoActual = Number(ocData.montoPagado || 0);
        const totalOCTx   = Number(ocData.resumen?.total || 0);
        const nuevoTotal  = pagadoActual + monto;
        if (nuevoTotal > totalOCTx + 0.01) throw new Error("Monto excede saldo pendiente");
        const saldoFinal  = Math.max(0, totalOCTx - nuevoTotal);
        const estadoFinal = saldoFinal <= 0.01 ? "Pagado" : "Pago Parcial";

        const facturaRef = doc(collection(db, `ordenesCompra/${oc.id}/facturas`));
        tx.set(facturaRef, {
          tipoComprobante, numero: nroComprobante, fecha, tipoPago,
          monto, tipoCambio: esDol ? tipoCambio : null,
          observaciones: observaciones || null,
          registradoPor: usuario?.email || "",
          creadaEn: serverTimestamp(),
          origenMasivo: true,
        });
        tx.update(ocRef, {
          estado: estadoFinal, montoPagado: nuevoTotal,
          montoPendiente: saldoFinal, fechaPago: fecha,
          actualizadoEn: new Date().toISOString(),
        });
      });
    };

    // Procesar en chunks paralelos
    for (let i = 0; i < validas.length; i += CHUNK_SIZE) {
      const chunk = validas.slice(i, i + CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map((fila) => procesarFila(fila))
      );
      settled.forEach((result, idx) => {
        const fila = chunk[idx];
        if (result.status === "fulfilled") {
          resultados.push({ ...fila, exito: true });
        } else {
          resultados.push({ ...fila, exito: false, errorRegistro: result.reason?.message || "Error desconocido" });
        }
      });
    }

    setResultadosMasivos(resultados);
    const exitosos = resultados.filter((r) => r.exito).length;
    if (exitosos > 0) {
      toast.success(`${exitosos} de ${validas.length} pagos registrados correctamente.`);
      const data = await obtenerOCsPendientesPago();
      setOCs(data || []);
    } else {
      toast.error("No se pudo registrar ningún pago.");
    }
    setProcesandoMasivo(false);
  };

  const limpiarMasivo = () => {
    setFilasMasivas([]);
    setResultadosMasivos(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── masivo: stats ──
  const statsFilas = useMemo(() => {
    const total = filasMasivas.length;
    const validas = filasMasivas.filter((f) => f.valido).length;
    const invalidas = total - validas;
    const montoTotal = filasMasivas.filter((f) => f.valido).reduce((s, f) => s + f.monto, 0);
    return { total, validas, invalidas, montoTotal };
  }, [filasMasivas]);

  if (loadingAuth || cargando) return <div className="p-6">Cargando…</div>;
  if (!usuario) return <div className="p-6 text-red-600">Acceso no autorizado</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-black">Registrar pago</h2>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setModo("individual")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === "individual" ? "bg-white shadow text-black" : "text-gray-500 hover:text-gray-700"}`}
          >
            <span className="flex items-center gap-1.5"><FileText size={14} />Individual</span>
          </button>
          <button
            onClick={() => setModo("masivo")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === "masivo" ? "bg-white shadow text-black" : "text-gray-500 hover:text-gray-700"}`}
          >
            <span className="flex items-center gap-1.5"><Layers size={14} />Carga masiva</span>
          </button>
        </div>
      </div>

      {/* ─── MODO INDIVIDUAL ─── */}
      {modo === "individual" && (
        <>
          {/* Buscador */}
          <div className="bg-white rounded shadow p-4 mb-5 relative">
            <label className="block text-sm font-medium mb-2 text-gray-700">Buscar orden de compra</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={busquedaRef}
                  className="border rounded pl-9 pr-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  placeholder="N° OC, proveedor o RUC…"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setMostrarLista(true); if (!e.target.value) setSel(null); }}
                  onFocus={() => setMostrarLista(true)}
                />
              </div>
              {sel && (
                <button onClick={limpiar} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            {mostrarLista && !sel && (
              <div className="absolute z-20 left-4 right-4 top-full mt-1 bg-white border rounded shadow-lg max-h-72 overflow-y-auto">
                {ocsFiltradas.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">Sin resultados</p>
                ) : (
                  ocsFiltradas.map((oc) => {
                    const saldoOC = Math.max(0, Number(oc.resumen?.total || 0) - Number(oc.montoPagado || 0));
                    return (
                      <button
                        key={oc.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0 transition-colors"
                        onClick={() => seleccionar(oc)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-sm text-black">{oc.numeroOC || oc.numero}</span>
                            <span className="text-gray-600 text-sm ml-2">{oc.proveedor?.razonSocial || "—"}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${oc.estado === "Pago Parcial" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                              {oc.estado}
                            </span>
                            <div className="text-xs text-gray-500 mt-0.5">Saldo: {formatearMoneda(saldoOC, oc.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles")}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {sel && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                  <div>
                    <span className="font-bold text-black">{sel.numeroOC || sel.numero}</span>
                    <span className="text-gray-600 ml-2 text-sm">{sel.proveedor?.razonSocial}</span>
                    {sel.proveedor?.ruc && <span className="text-gray-400 text-xs ml-2">RUC {sel.proveedor.ruc}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sel.estado === "Pago Parcial" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                    {sel.estado}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Resumen financiero</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Total OC</p>
                        <p className="font-bold text-sm text-gray-800">{formatearMoneda(totalOC, moneda)}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Pagado</p>
                        <p className="font-bold text-sm text-gray-800">{formatearMoneda(montoPagadoPrev, moneda)}</p>
                      </div>
                      <div className="bg-amber-50 rounded p-2 text-center">
                        <p className="text-xs text-amber-500">Saldo</p>
                        <p className="font-bold text-sm text-amber-700">{formatearMoneda(saldo, moneda)}</p>
                      </div>
                    </div>
                    {(sel.resumen?.detraccion > 0 || sel.resumen?.retencion > 0) && (
                      <div className="flex gap-2 mt-2">
                        {sel.resumen?.detraccion > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Detracción {formatearMoneda(sel.resumen.detraccion, moneda)}
                          </span>
                        )}
                        {sel.resumen?.retencion > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                            Retención {formatearMoneda(sel.resumen.retencion, moneda)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Datos bancarios</p>
                    <div className="text-sm space-y-1 text-gray-700">
                      {sel.banco ? (
                        <>
                          <div className="flex items-center gap-1.5"><CreditCard size={13} className="text-gray-400" />{sel.banco}</div>
                          {sel.cuentaBancaria && <div className="text-xs text-gray-500 pl-5">Cta: {sel.cuentaBancaria}</div>}
                          {sel.cuentaInterbancaria && <div className="text-xs text-gray-500 pl-5">CCI: {sel.cuentaInterbancaria}</div>}
                        </>
                      ) : (
                        <p className="text-gray-400 text-xs">Sin datos bancarios</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Formulario de pago */}
          {sel && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-800">
                <FileText size={16} className="text-black" />
                Datos del comprobante y pago
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de comprobante</label>
                  <select className="border rounded px-3 py-2 w-full text-sm" value={form.tipoComprobante} onChange={(e) => setForm({ ...form, tipoComprobante: e.target.value })}>
                    {TIPOS_COMPROBANTE.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">N° comprobante</label>
                  <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Ej. F001-00123" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                  <input className="border rounded px-3 py-2 w-full text-sm" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de pago</label>
                  <select className="border rounded px-3 py-2 w-full text-sm" value={form.tipoPago} onChange={(e) => setForm({ ...form, tipoPago: e.target.value })}>
                    {TIPOS_PAGO.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Monto pagado ({moneda})
                    <span className="ml-1 text-amber-600">· saldo: {formatearMoneda(saldo, moneda)}</span>
                  </label>
                  <input className="border rounded px-3 py-2 w-full text-sm" type="number" step="0.01" min="0" max={saldo} placeholder={`Máx. ${saldo.toFixed(2)}`} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                </div>
                {esDolares && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <DollarSign size={11} />
                      Tipo de cambio (S/ por USD)
                    </label>
                    <input className="border rounded px-3 py-2 w-full text-sm" type="number" step="0.001" min="0" placeholder="Ej. 3.750" value={form.tipoCambio} onChange={(e) => setForm({ ...form, tipoCambio: e.target.value })} />
                  </div>
                )}
                <div className={esDolares ? "" : "md:col-span-2"}>
                  <label className="block text-xs text-gray-500 mb-1">Observaciones (opcional)</label>
                  <input className="border rounded px-3 py-2 w-full text-sm" placeholder="Ej. Pago parcial acuerdo con proveedor" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>
              </div>
              <div className="mb-4">
                <label className="inline-flex items-center gap-2 text-sm text-black underline cursor-pointer">
                  <Paperclip size={14} />
                  {form.archivo ? form.archivo.name : "Adjuntar comprobante (PDF/JPG/PNG)"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setForm({ ...form, archivo: e.target.files[0] || null })} />
                </label>
              </div>
              {estadoResultante && montoForm > 0 && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded mb-4 ${estadoResultante === "Pagado" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {estadoResultante === "Pagado" ? <CheckCircle size={15} /> : <Clock size={15} />}
                  <span>
                    Al registrar: estado → <b>{estadoResultante}</b>
                    {estadoResultante === "Pago Parcial" && ` · Saldo restante: ${formatearMoneda(nuevoSaldo, moneda)}`}
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={limpiar} className="px-4 py-2 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className={`px-5 py-2 rounded text-sm font-semibold transition-colors ${guardando ? "bg-[#f0c000]/60 text-black cursor-not-allowed" : "bg-[#f0c000] hover:bg-[#d4a800] text-black"}`}>
                  {guardando ? "Guardando…" : "Registrar pago"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── MODO MASIVO ─── */}
      {modo === "masivo" && (
        <div className="space-y-5">
          {/* Instrucciones + plantilla */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-black mb-1 flex items-center gap-2"><Upload size={15} />Carga masiva de pagos</p>
              <p className="text-sm text-gray-700">Sube un Excel con múltiples pagos. Las columnas requeridas son:</p>
              <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                <li><b>N° OC</b>, <b>N° Comprobante</b>, <b>Fecha (YYYY-MM-DD)</b>, <b>Monto</b></li>
                <li>Opcionales: Tipo Comprobante, Tipo Pago, Tipo de Cambio (solo USD), Observaciones</li>
              </ul>
            </div>
            <button
              onClick={descargarPlantilla}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-black text-black rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shrink-0"
            >
              <Download size={14} />
              Descargar plantilla
            </button>
          </div>

          {/* Drop / select area */}
          {!resultadosMasivos && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-black hover:bg-gray-100/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onArchivoMasivo(f); }}
            >
              <Upload size={28} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">Arrastra tu archivo aquí o haz clic para seleccionar</p>
              <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .xls, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files[0]; if (f) onArchivoMasivo(f); }}
              />
            </div>
          )}

          {/* Vista previa de filas */}
          {filasMasivas.length > 0 && !resultadosMasivos && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total filas", valor: statsFilas.total, color: "text-gray-800" },
                  { label: "Válidas", valor: statsFilas.validas, color: "text-green-700" },
                  { label: "Con errores", valor: statsFilas.invalidas, color: statsFilas.invalidas > 0 ? "text-red-600" : "text-gray-400" },
                  { label: "Monto total", valor: `S/ ${statsFilas.montoTotal.toFixed(2)}`, color: "text-black", raw: true },
                ].map(({ label, valor, color, raw }) => (
                  <div key={label} className="bg-white border rounded-xl p-3 text-center shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{raw ? valor : valor}</p>
                  </div>
                ))}
              </div>

              {/* Tabla preview */}
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <p className="font-semibold text-gray-800 text-sm">Vista previa — {filasMasivas.length} fila{filasMasivas.length !== 1 ? "s" : ""}</p>
                  <button onClick={limpiarMasivo} className="text-xs text-gray-400 hover:text-red-500">Limpiar</button>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {["#", "N° OC", "Comprobante", "Fecha", "Monto", "Estado", "Errores"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasMasivas.map((f, i) => (
                        <tr key={i} className={`border-t ${f.valido ? "hover:bg-gray-50" : "bg-red-50"}`}>
                          <td className="px-3 py-1.5 text-gray-400">{f.fila}</td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-black">{f.nroOC}</td>
                          <td className="px-3 py-1.5">{f.tipoComprobante} {f.nroComprobante}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{f.fecha}</td>
                          <td className="px-3 py-1.5 font-mono">{f.monto > 0 ? f.monto.toFixed(2) : "—"}</td>
                          <td className="px-3 py-1.5">
                            {f.valido ? (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle size={11} />OK</span>
                            ) : (
                              <span className="text-red-600 flex items-center gap-1"><AlertCircle size={11} />Error</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-red-600">{f.errores.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={limpiarMasivo} className="px-4 py-2 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={procesarPagosMasivos}
                  disabled={procesandoMasivo || statsFilas.validas === 0}
                  className={`px-5 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2 ${procesandoMasivo || statsFilas.validas === 0 ? "bg-[#f0c000]/60 text-black cursor-not-allowed" : "bg-[#f0c000] hover:bg-[#d4a800] text-black"}`}
                >
                  {procesandoMasivo ? (
                    <><Clock size={14} className="animate-spin" />Procesando…</>
                  ) : (
                    <><CheckCircle size={14} />Registrar {statsFilas.validas} pago{statsFilas.validas !== 1 ? "s" : ""}</>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Resultados post-proceso */}
          {resultadosMasivos && (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <CheckCircle size={15} className="text-green-600" />
                  Resultado del proceso
                </p>
                <button
                  onClick={limpiarMasivo}
                  className="text-xs text-black font-medium hover:underline"
                >
                  Cargar otro archivo
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["N° OC", "Comprobante", "Monto", "Resultado", "Detalle"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosMasivos.map((r, i) => (
                      <tr key={i} className={`border-t ${r.exito ? "bg-green-50/40" : "bg-red-50"}`}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-black">{r.nroOC}</td>
                        <td className="px-3 py-1.5">{r.tipoComprobante} {r.nroComprobante}</td>
                        <td className="px-3 py-1.5 font-mono">{r.monto.toFixed(2)}</td>
                        <td className="px-3 py-1.5">
                          {r.exito
                            ? <span className="text-green-700 font-semibold flex items-center gap-1"><CheckCircle size={11} />Registrado</span>
                            : <span className="text-red-600 font-semibold flex items-center gap-1"><AlertCircle size={11} />Fallido</span>
                          }
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">{r.errorRegistro || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegistrarPago;
