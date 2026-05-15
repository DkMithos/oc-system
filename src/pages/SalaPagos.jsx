// src/pages/SalaPagos.jsx
// Fase 5c: Vista proyectable para reunión semanal de Mesa de Pagos.
// Muestra transacciones pendientes priorizadas, permite asignar compromisos,
// registrar decisiones y gestionar la sesión de pago.

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { toast } from "react-toastify";
import BackButton from "../components/ui/BackButton";
import {
  obtenerTransaccionesMesaPagos,
  crearSesionPago,
  obtenerSesionesPago,
  registrarDecisionMesa,
  finalizarSesionPago,
} from "../firebase/mesaPagosHelpers";
import {
  obtenerInstrumentosConSaldo,
  registrarUsoInstrumento,
} from "../firebase/instrumentosHelpers";
import { SkeletonCard, SkeletonKPI } from "../components/ui/Skeleton";
import {
  AlertTriangle, CheckCircle, Clock, DollarSign,
  Play, Square, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";

// ── Constantes ──
const AREAS = [
  { id: "", label: "Todas" },
  { id: "administracion", label: "Administración" },
  { id: "contabilidad", label: "Contabilidad" },
  { id: "operaciones", label: "Operaciones" },
  { id: "ti", label: "TI" },
];

const PRESION_OPTIONS = [
  { id: "baja", label: "Baja", color: "bg-gray-100 text-gray-600" },
  { id: "media", label: "Media", color: "bg-amber-100 text-amber-700" },
  { id: "alta", label: "Alta", color: "bg-orange-100 text-orange-700" },
  { id: "critica", label: "Critica", color: "bg-red-100 text-red-700" },
];

const IMPORTANCIA_OPTIONS = [
  { id: "baja", label: "Baja" },
  { id: "media", label: "Media" },
  { id: "alta", label: "Alta" },
];

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// ── Datos demo para preview ──────────────────────────────────────
const DEMO_TRANSACCIONES = [
  { id: "demo-1", proveedor_cliente_nombre: "Ferreyros S.A.", categoriaNombre: "Maquinaria y Equipos", area: "operaciones", documento_tipo: "FAC", documento_numero: "F001-00234", monto_total_pen: 45800, moneda: "PEN", presion: "critica", prioridad_score: 78, vencido: true, diasVencido: 12, compromiso_fecha: "2026-05-20", mesa_discutido: false, fechaISO: "2026-04-30", programado_fechaISO: "2026-04-30" },
  { id: "demo-2", proveedor_cliente_nombre: "Komatsu Mitsui Maquinarias", categoriaNombre: "Repuestos y Mantenimiento", area: "operaciones", documento_tipo: "FAC", documento_numero: "F001-00189", monto_total_pen: 28500, moneda: "PEN", presion: "alta", prioridad_score: 52, vencido: false, diasVencido: 0, compromiso_fecha: "2026-05-18", mesa_discutido: true, fechaISO: "2026-05-05", programado_fechaISO: "2026-05-18" },
  { id: "demo-3", proveedor_cliente_nombre: "Suministros del Norte E.I.R.L.", categoriaNombre: "Materiales de Oficina", area: "administracion", documento_tipo: "BOL", documento_numero: "B001-00056", monto_total_pen: 3200, moneda: "PEN", presion: "media", prioridad_score: 25, vencido: false, diasVencido: 0, compromiso_fecha: "", mesa_discutido: false, fechaISO: "2026-05-08", programado_fechaISO: "" },
  { id: "demo-4", proveedor_cliente_nombre: "Tecniplus SAC", categoriaNombre: "Servicios TI", area: "ti", documento_tipo: "FAC", documento_numero: "F002-00412", monto_total_pen: 12600, moneda: "PEN", presion: "baja", prioridad_score: 10, vencido: false, diasVencido: 0, compromiso_fecha: "", mesa_discutido: false, fechaISO: "2026-05-10", programado_fechaISO: "" },
];
const DEMO_SESION_ACTIVA = { id: "demo-sesion-1", titulo: "Mesa de Pagos — 14 May 2026", estado: "activa", transaccionesDiscutidas: ["demo-2"], creadoEn: null };
const DEMO_SESIONES = [
  { id: "demo-sesion-1", titulo: "Mesa de Pagos — 14 May 2026", estado: "activa", transaccionesDiscutidas: ["demo-2"], creadoEn: null },
  { id: "demo-sesion-0", titulo: "Mesa de Pagos — 07 May 2026", estado: "finalizada", transaccionesDiscutidas: ["demo-1", "demo-3"], creadoEn: null },
];
const DEMO_CIPRLS = [
  { id: "ciprl-1", codigo: "CIPRL-2026-001", saldo: 85000 },
  { id: "ciprl-2", codigo: "CIPRL-2026-002", saldo: 32500 },
];

// ── Componente principal ──
export default function SalaPagos() {
  const { usuario, cargando: authLoading } = useUsuario();

  const [transacciones, setTransacciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroArea, setFiltroArea] = useState("");
  const [sesionActiva, setSesionActiva] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [expandido, setExpandido] = useState(null); // ID de transacción expandida
  const [decision, setDecision] = useState({});
  const [instrumentosCIPRL, setInstrumentosCIPRL] = useState([]);
  const [aplicandoCIPRL, setAplicandoCIPRL] = useState(null);
  const [esDemo, setEsDemo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [txs, sess, ciprlList] = await Promise.all([
        obtenerTransaccionesMesaPagos({ area: filtroArea || undefined }),
        obtenerSesionesPago(5),
        obtenerInstrumentosConSaldo("ciprl").catch(() => []),
      ]);
      // [DEMO] Si no hay datos reales, mostrar datos simulados para preview
      if (txs.length === 0) {
        setTransacciones(DEMO_TRANSACCIONES);
        setSesiones(DEMO_SESIONES);
        setSesionActiva(DEMO_SESION_ACTIVA);
        setInstrumentosCIPRL(DEMO_CIPRLS);
        setEsDemo(true);
      } else {
        setTransacciones(txs);
        setSesiones(sess);
        setInstrumentosCIPRL(ciprlList);
        const activa = sess.find((s) => s.estado === "activa");
        if (activa) setSesionActiva(activa);
        setEsDemo(false);
      }
    } catch (e) {
      console.error("Error cargando mesa de pagos:", e);
    } finally {
      setCargando(false);
    }
  }, [filtroArea]);

  useEffect(() => {
    if (!authLoading) cargar();
  }, [authLoading, cargar]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = transacciones.reduce((acc, t) => acc + Number(t.monto_total_pen ?? t.monto_total ?? 0), 0);
    const vencidas = transacciones.filter((t) => t.vencido);
    const montoVencido = vencidas.reduce((acc, t) => acc + Number(t.monto_total_pen ?? t.monto_total ?? 0), 0);
    const conCompromiso = transacciones.filter((t) => t.compromiso_fecha && t.compromiso_estado === "pendiente");
    const criticas = transacciones.filter((t) => (t.presion || "").toLowerCase() === "critica");
    return {
      totalPendiente: total,
      cantPendiente: transacciones.length,
      montoVencido,
      cantVencidas: vencidas.length,
      cantCompromisos: conCompromiso.length,
      cantCriticas: criticas.length,
    };
  }, [transacciones]);

  // ── Iniciar sesión de mesa ──
  const iniciarSesion = async () => {
    try {
      const id = await crearSesionPago({
        creadoPorEmail: usuario.email,
        participantes: [usuario.email],
      });
      const sess = await obtenerSesionesPago(5);
      setSesiones(sess);
      setSesionActiva(sess.find((s) => s.id === id) || null);
      toast.success("Sesión de Mesa de Pagos iniciada");
    } catch (e) {
      toast.error("Error al iniciar sesión");
    }
  };

  const finalizarSesion = async () => {
    if (!sesionActiva) return;
    try {
      await finalizarSesionPago(sesionActiva.id);
      setSesionActiva(null);
      toast.success("Sesión finalizada");
      await cargar();
    } catch (e) {
      toast.error("Error al finalizar sesión");
    }
  };

  // ── Registrar decisión ──
  const guardarDecision = async (transaccionId) => {
    if (!sesionActiva) {
      toast.warning("Inicie una sesión de Mesa de Pagos primero");
      return;
    }
    const dec = decision[transaccionId] || {};
    try {
      await registrarDecisionMesa(sesionActiva.id, transaccionId, {
        compromiso_fecha: dec.compromiso_fecha || "",
        compromiso_nota: dec.compromiso_nota || "",
        presion: dec.presion || "",
        importancia: dec.importancia || "",
        mesa_decision: dec.mesa_decision || "",
      });
      toast.success("Decisión registrada");
      setExpandido(null);
      setDecision((prev) => ({ ...prev, [transaccionId]: {} }));
      await cargar();
    } catch (e) {
      toast.error("Error al registrar decisión");
    }
  };

  const updateDecision = (txId, field, value) => {
    setDecision((prev) => ({
      ...prev,
      [txId]: { ...(prev[txId] || {}), [field]: value },
    }));
  };

  // ── Aplicar CIPRL a transacción ──
  const aplicarCIPRL = async (transaccionId, instrumentoId, monto, concepto) => {
    if (!instrumentoId || !monto || monto <= 0) {
      toast.warn("Seleccione un CIPRL e ingrese un monto válido");
      return;
    }
    setAplicandoCIPRL(transaccionId);
    try {
      await registrarUsoInstrumento(instrumentoId, {
        monto,
        concepto: concepto || `Aplicado a transacción ${transaccionId}`,
        transaccionId,
      }, usuario?.email || "");
      toast.success("CIPRL aplicado correctamente");
      await cargar();
    } catch (e) {
      toast.error(e.message || "Error al aplicar CIPRL");
    } finally {
      setAplicandoCIPRL(null);
    }
  };

  // ── Render ──
  if (authLoading || cargando) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonKPI count={4} />
        <SkeletonCard lines={10} />
      </div>
    );
  }

  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl font-bold text-black">Mesa de Pagos</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Triage semanal — Priorización de pagos pendientes
            {sesionActiva && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Sesión activa
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          {!sesionActiva ? (
            <button
              onClick={iniciarSesion}
              className="flex items-center gap-1.5 bg-[#f0c000] hover:bg-[#d4a800] text-black text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Play size={12} /> Iniciar Sesión
            </button>
          ) : (
            <button
              onClick={finalizarSesion}
              className="flex items-center gap-1.5 bg-red-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square size={12} /> Finalizar
            </button>
          )}
        </div>
      </div>

      {/* Banner demo */}
      {esDemo && (
        <p className="text-[10px] text-gray-400 italic text-center -mt-2">
          Vista previa con datos de ejemplo — no hay transacciones reales pendientes
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Total Pendiente" valor={`S/ ${fmt(kpis.totalPendiente)}`} sub={`${kpis.cantPendiente} transacciones`} color="text-black" />
        <KpiCard icon={AlertTriangle} label="Monto Vencido" valor={`S/ ${fmt(kpis.montoVencido)}`} sub={`${kpis.cantVencidas} vencidas`} color="text-red-600" />
        <KpiCard icon={Calendar} label="Con Compromiso" valor={kpis.cantCompromisos} sub="pendientes de cumplir" color="text-amber-600" />
        <KpiCard icon={AlertTriangle} label="Presión Critica" valor={kpis.cantCriticas} sub="requieren atención" color="text-red-700" />
      </div>

      {/* Tabla principal */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Pagos Priorizados ({transacciones.length})
          </h3>
          <span className="text-[10px] text-gray-400">Ordenados por score de prioridad (mayor = más urgente)</span>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {transacciones.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={36} className="mx-auto mb-2 text-green-300" />
              <p>No hay pagos pendientes</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transacciones.map((t, idx) => {
                const isExpanded = expandido === t.id;
                const presionCfg = PRESION_OPTIONS.find((p) => p.id === (t.presion || "baja")) || PRESION_OPTIONS[0];
                const monto = Number(t.monto_total_pen ?? t.monto_total ?? 0);

                return (
                  <div key={t.id} className={`${t.vencido ? "bg-red-50/40" : ""} ${isExpanded ? "bg-gray-50/60" : ""}`}>
                    {/* Fila principal */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandido(isExpanded ? null : t.id)}
                    >
                      {/* Score badge */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        t.prioridad_score > 50 ? "bg-red-100 text-red-700"
                        : t.prioridad_score > 20 ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        {Math.round(t.prioridad_score)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {t.proveedor_cliente_nombre || "Sin proveedor"}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${presionCfg.color}`}>
                            {presionCfg.label}
                          </span>
                          {t.vencido && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white">
                              VENCIDO {t.diasVencido}d
                            </span>
                          )}
                          {t.mesa_discutido && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600">
                              Discutido
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {t.categoriaNombre || "Sin categoría"} · {t.area || "—"} · {t.documento_tipo ? `${t.documento_tipo} ${t.documento_numero || ""}` : "Sin doc."}
                          {t.compromiso_fecha && (
                            <span className="ml-2 text-amber-600">Compromiso: {t.compromiso_fecha}</span>
                          )}
                        </p>
                      </div>

                      {/* Monto + fecha */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">
                          {t.moneda === "USD" ? "US$ " : "S/ "}{fmt(monto)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {t.programado_fechaISO || t.fechaISO || "—"}
                        </p>
                      </div>

                      {/* Expand */}
                      <div className="flex-shrink-0 text-gray-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Panel expandido: decisión */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                          {/* Presión */}
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase font-medium">Presión proveedor</label>
                            <select
                              value={(decision[t.id]?.presion) || t.presion || "baja"}
                              onChange={(e) => updateDecision(t.id, "presion", e.target.value)}
                              className="w-full mt-1 border border-gray-200 rounded px-2 py-1.5 text-xs"
                            >
                              {PRESION_OPTIONS.map((p) => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Importancia */}
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase font-medium">Importancia</label>
                            <select
                              value={(decision[t.id]?.importancia) || t.importancia || "baja"}
                              onChange={(e) => updateDecision(t.id, "importancia", e.target.value)}
                              className="w-full mt-1 border border-gray-200 rounded px-2 py-1.5 text-xs"
                            >
                              {IMPORTANCIA_OPTIONS.map((p) => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Compromiso fecha */}
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase font-medium">Compromiso de pago</label>
                            <input
                              type="date"
                              value={(decision[t.id]?.compromiso_fecha) || t.compromiso_fecha || ""}
                              onChange={(e) => updateDecision(t.id, "compromiso_fecha", e.target.value)}
                              className="w-full mt-1 border border-gray-200 rounded px-2 py-1.5 text-xs"
                            />
                          </div>

                          {/* Decisión */}
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase font-medium">Decisión / Nota</label>
                            <input
                              type="text"
                              placeholder="Ej: Pagar prox semana..."
                              value={(decision[t.id]?.mesa_decision) || ""}
                              onChange={(e) => updateDecision(t.id, "mesa_decision", e.target.value)}
                              className="w-full mt-1 border border-gray-200 rounded px-2 py-1.5 text-xs"
                            />
                          </div>
                        </div>

                        {/* CIPRL disponible */}
                        {instrumentosCIPRL.length > 0 && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-[10px] text-gray-600 uppercase font-semibold mb-2">Aplicar CIPRL</p>
                            <div className="flex flex-wrap items-end gap-2">
                              <select
                                value={decision[t.id]?.ciprl_instrumento || ""}
                                onChange={(e) => updateDecision(t.id, "ciprl_instrumento", e.target.value)}
                                className="flex-1 min-w-[140px] border border-gray-200 rounded px-2 py-1.5 text-xs bg-white"
                              >
                                <option value="">Seleccionar CIPRL...</option>
                                {instrumentosCIPRL.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.codigo} — Saldo: S/ {fmt(c.saldo)}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Monto"
                                value={decision[t.id]?.ciprl_monto || ""}
                                onChange={(e) => updateDecision(t.id, "ciprl_monto", e.target.value)}
                                className="w-28 border border-gray-200 rounded px-2 py-1.5 text-xs"
                              />
                              <button
                                onClick={() => aplicarCIPRL(
                                  t.id,
                                  decision[t.id]?.ciprl_instrumento,
                                  Number(decision[t.id]?.ciprl_monto || 0),
                                  `Pago ${t.proveedor_cliente_nombre || ""} - ${t.documento_numero || ""}`
                                )}
                                disabled={aplicandoCIPRL === t.id || !decision[t.id]?.ciprl_instrumento}
                                className="px-3 py-1.5 bg-black text-white text-xs rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                              >
                                {aplicandoCIPRL === t.id ? "Aplicando..." : "Aplicar"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end mt-3">
                          <button
                            onClick={() => guardarDecision(t.id)}
                            disabled={!sesionActiva}
                            className="px-4 py-1.5 bg-[#f0c000] hover:bg-[#d4a800] text-black text-xs font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {sesionActiva ? "Guardar Decisión" : "Inicie sesión primero"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sesiones recientes */}
      {sesiones.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Sesiones Recientes</h3>
          <div className="space-y-2">
            {sesiones.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs border-b border-gray-50 pb-2">
                <div>
                  <span className="font-medium text-gray-700">{s.titulo}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    s.estado === "activa" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {s.estado}
                  </span>
                </div>
                <div className="text-gray-400">
                  {s.transaccionesDiscutidas?.length || 0} discutidas
                  {s.creadoEn?.toDate && (
                    <span className="ml-2">{s.creadoEn.toDate().toLocaleDateString("es-PE")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-center">
        Score = f(dias vencido, monto, presion, importancia, compromiso). Mayor score = mayor urgencia.
      </p>
    </div>
  );
}

// ── KPI Card ──
function KpiCard({ icon: Icon, label, valor, sub, color = "text-gray-800" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gray-400" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className={`text-lg font-bold font-mono ${color}`}>{valor}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
