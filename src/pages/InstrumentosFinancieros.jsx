// src/pages/InstrumentosFinancieros.jsx
// Fase 6: Gestión de instrumentos financieros (CIPRL, cartas fianza, etc.)

import React, { useEffect, useState, useCallback } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { toast } from "react-toastify";
import {
  obtenerInstrumentos,
  crearInstrumento,
  registrarUsoInstrumento,
  registrarAbonoInstrumento,
  anularInstrumento,
  TIPOS_INSTRUMENTO,
} from "../firebase/instrumentosHelpers";
import { SkeletonCard } from "../components/ui/Skeleton";
import {
  Plus, RefreshCw, DollarSign, TrendingDown, TrendingUp, XCircle,
  ChevronDown, ChevronUp, FileText, Calendar, Building2, AlertTriangle,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const ESTADOS_BADGE = {
  activo:  "bg-green-100 text-green-700 border-green-200",
  agotado: "bg-gray-100 text-gray-600 border-gray-200",
  vencido: "bg-amber-100 text-amber-700 border-amber-200",
  anulado: "bg-red-100 text-red-700 border-red-200",
};

// ── Modal Crear Instrumento ─────────────────────────────────
function ModalCrear({ onClose, onCreado, email }) {
  const [form, setForm] = useState({
    tipo: "ciprl", codigo: "", descripcion: "", monto_total: "",
    moneda: "PEN", entidad_emisora: "", fecha_emision: "", fecha_vencimiento: "",
    proyecto: "", notas: "",
  });
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.codigo.trim()) return toast.warn("Ingrese un código");
    if (!form.monto_total || Number(form.monto_total) <= 0) return toast.warn("Ingrese un monto válido");
    setGuardando(true);
    try {
      await crearInstrumento({ ...form, monto_total: Number(form.monto_total) }, email);
      toast.success("Instrumento creado");
      onCreado();
    } catch (err) {
      toast.error(err.message || "Error al crear instrumento");
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#004990]">Nuevo Instrumento Financiero</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
                {TIPOS_INSTRUMENTO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Código / N.o</label>
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={inputCls} placeholder="Ej: CIPRL-2026-001" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={inputCls} placeholder="Descripción del instrumento" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto Total</label>
              <input type="number" step="0.01" min="0" value={form.monto_total} onChange={(e) => setForm({ ...form, monto_total: e.target.value })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} className={inputCls}>
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Entidad Emisora</label>
            <input value={form.entidad_emisora} onChange={(e) => setForm({ ...form, entidad_emisora: e.target.value })} className={inputCls} placeholder="Gobierno Regional, Banco, etc." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de Emisión</label>
              <input type="date" value={form.fecha_emision} onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de Vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Proyecto Asociado</label>
            <input value={form.proyecto} onChange={(e) => setForm({ ...form, proyecto: e.target.value })} className={inputCls} placeholder="Proyecto vinculado (opcional)" />
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={inputCls} placeholder="Observaciones adicionales" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={guardando} className="px-4 py-2 text-sm bg-[#004990] text-white rounded-lg hover:bg-[#003670] disabled:opacity-50 flex items-center gap-1.5">
              {guardando ? "Guardando..." : <><Plus size={14} /> Crear</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Movimiento (Uso / Abono) ──────────────────────────
function ModalMovimiento({ instrumento, tipo, onClose, onGuardado, email }) {
  const [form, setForm] = useState({ monto: "", concepto: "", referencia: "" });
  const [guardando, setGuardando] = useState(false);
  const esUso = tipo === "uso";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const monto = Number(form.monto);
    if (!monto || monto <= 0) return toast.warn("Ingrese un monto válido");
    if (esUso && monto > instrumento.saldo) return toast.warn(`Saldo insuficiente (${fmt(instrumento.saldo)})`);
    setGuardando(true);
    try {
      if (esUso) {
        await registrarUsoInstrumento(instrumento.id, form, email);
        toast.success("Uso registrado");
      } else {
        await registrarAbonoInstrumento(instrumento.id, form, email);
        toast.success("Abono registrado");
      }
      onGuardado();
    } catch (err) {
      toast.error(err.message || "Error al registrar movimiento");
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#004990]">
            {esUso ? "Registrar Uso" : "Registrar Abono"} — {instrumento.codigo}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {esUso && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <span className="text-blue-700 font-medium">Saldo disponible:</span>{" "}
              <span className="font-bold">{instrumento.moneda === "USD" ? "US$ " : "S/ "}{fmt(instrumento.saldo)}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
            <input type="number" step="0.01" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputCls} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
            <input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} className={inputCls} placeholder="Descripción del movimiento" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
            <input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className={inputCls} placeholder="N.o de documento, OC, etc." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={guardando} className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${esUso ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
              {guardando ? "Guardando..." : esUso ? <><TrendingDown size={14} /> Descontar</> : <><TrendingUp size={14} /> Abonar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente Principal ────────────────────────────────────
export default function InstrumentosFinancieros() {
  const { usuario, cargando: authLoading } = useUsuario();
  const [instrumentos, setInstrumentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalMov, setModalMov] = useState(null); // { instrumento, tipo: "uso"|"abono" }

  const rol = String(usuario?.rol || "").toLowerCase();
  const email = usuario?.email || "";
  const puedeEditar = ["admin", "soporte", "finanzas", "gerencia finanzas"].includes(rol);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerInstrumentos({
        tipo: filtroTipo || undefined,
        estado: filtroEstado || undefined,
      });
      setInstrumentos(data);
    } catch (e) {
      console.error("Error cargando instrumentos:", e);
    } finally {
      setCargando(false);
    }
  }, [filtroTipo, filtroEstado]);

  useEffect(() => {
    if (!authLoading) cargar();
  }, [authLoading, cargar]);

  const handleAnular = async (inst) => {
    if (!window.confirm(`Anular instrumento ${inst.codigo}?`)) return;
    try {
      await anularInstrumento(inst.id, "Anulado desde panel", email);
      toast.info("Instrumento anulado");
      await cargar();
    } catch (e) {
      toast.error(e.message || "Error al anular");
    }
  };

  // KPIs
  const activos = instrumentos.filter((i) => i.estado === "activo");
  const saldoTotal = activos.reduce((acc, i) => acc + (i.saldo || 0), 0);
  const montoTotal = instrumentos.reduce((acc, i) => acc + (i.monto_total || 0), 0);
  const totalUtilizado = instrumentos.reduce((acc, i) => acc + (i.monto_utilizado || 0), 0);

  if (authLoading || cargando) {
    return <div className="p-6 space-y-6"><SkeletonCard lines={8} /></div>;
  }
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#004990]">Instrumentos Financieros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            CIPRL, cartas fianza y otros instrumentos con saldo
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} disabled={cargando} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} className={cargando ? "animate-spin" : ""} /> Actualizar
          </button>
          {puedeEditar && (
            <button onClick={() => setModalCrear(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#004990] text-white rounded-lg text-sm hover:bg-[#003670]">
              <Plus size={14} /> Nuevo
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-gray-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Instrumentos Activos</p>
          </div>
          <p className="text-xl font-bold text-[#004990]">{activos.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-green-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Saldo Disponible</p>
          </div>
          <p className="text-xl font-bold text-green-700">S/ {fmt(saldoTotal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Total Utilizado</p>
          </div>
          <p className="text-xl font-bold text-red-600">S/ {fmt(totalUtilizado)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-gray-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Monto Emitido Total</p>
          </div>
          <p className="text-lg font-bold text-gray-800">S/ {fmt(montoTotal)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 outline-none">
          <option value="">Todos los tipos</option>
          {TIPOS_INSTRUMENTO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 outline-none">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="agotado">Agotado</option>
          <option value="vencido">Vencido</option>
          <option value="anulado">Anulado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {instrumentos.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No hay instrumentos financieros registrados</p>
            {puedeEditar && (
              <button onClick={() => setModalCrear(true)} className="mt-3 text-sm text-[#004990] underline hover:text-[#003670]">
                Crear el primero
              </button>
            )}
          </div>
        ) : (
          instrumentos.map((inst) => {
            const abierto = expandido === inst.id;
            const pctUsado = inst.monto_total > 0 ? ((inst.monto_utilizado || 0) / inst.monto_total) * 100 : 0;
            const tipoLabel = TIPOS_INSTRUMENTO.find((t) => t.id === inst.tipo)?.nombre || inst.tipo;
            const monedaSym = inst.moneda === "USD" ? "US$ " : "S/ ";

            // Alerta de vencimiento
            let alertaVenc = null;
            if (inst.fecha_vencimiento && inst.estado === "activo") {
              const diasVenc = Math.floor((new Date(inst.fecha_vencimiento + "T00:00:00") - new Date()) / 86400000);
              if (diasVenc < 0) alertaVenc = { texto: `Vencido hace ${Math.abs(diasVenc)}d`, color: "text-red-600" };
              else if (diasVenc <= 30) alertaVenc = { texto: `Vence en ${diasVenc}d`, color: "text-amber-600" };
            }

            return (
              <div key={inst.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Header card */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandido(abierto ? null : inst.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-800">{inst.codigo}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          {tipoLabel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${ESTADOS_BADGE[inst.estado] || ESTADOS_BADGE.activo}`}>
                          {inst.estado?.toUpperCase()}
                        </span>
                        {alertaVenc && (
                          <span className={`flex items-center gap-1 text-[10px] font-medium ${alertaVenc.color}`}>
                            <AlertTriangle size={10} /> {alertaVenc.texto}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">{inst.descripcion || "Sin descripción"}</p>
                      {inst.entidad_emisora && (
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Building2 size={10} /> {inst.entidad_emisora}
                        </p>
                      )}
                    </div>

                    {/* Saldo & barra */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Saldo</p>
                        <p className="text-sm font-bold text-green-700">{monedaSym}{fmt(inst.saldo)}</p>
                        <p className="text-[10px] text-gray-400">de {monedaSym}{fmt(inst.monto_total)}</p>
                      </div>
                      <div className="w-20 hidden sm:block">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${pctUsado > 90 ? "bg-red-500" : pctUsado > 60 ? "bg-amber-400" : "bg-green-500"}`}
                            style={{ width: `${Math.min(pctUsado, 100)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 text-center mt-0.5">{pctUsado.toFixed(0)}% usado</p>
                      </div>
                      {abierto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>
                </div>

                {/* Detalle expandido */}
                {abierto && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    {/* Info adicional */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
                      {inst.fecha_emision && (
                        <div>
                          <span className="text-gray-400 block">Emisión</span>
                          <span className="font-medium flex items-center gap-1"><Calendar size={10} /> {inst.fecha_emision}</span>
                        </div>
                      )}
                      {inst.fecha_vencimiento && (
                        <div>
                          <span className="text-gray-400 block">Vencimiento</span>
                          <span className="font-medium flex items-center gap-1"><Calendar size={10} /> {inst.fecha_vencimiento}</span>
                        </div>
                      )}
                      {inst.proyecto && (
                        <div>
                          <span className="text-gray-400 block">Proyecto</span>
                          <span className="font-medium">{inst.proyecto}</span>
                        </div>
                      )}
                      {inst.notas && (
                        <div className="col-span-2">
                          <span className="text-gray-400 block">Notas</span>
                          <span className="font-medium">{inst.notas}</span>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    {puedeEditar && inst.estado === "activo" && (
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setModalMov({ instrumento: inst, tipo: "uso" })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[11px] font-medium hover:bg-red-700"
                        >
                          <TrendingDown size={12} /> Registrar Uso
                        </button>
                        <button
                          onClick={() => setModalMov({ instrumento: inst, tipo: "abono" })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-medium hover:bg-green-700"
                        >
                          <TrendingUp size={12} /> Registrar Abono
                        </button>
                        <button
                          onClick={() => handleAnular(inst)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-[11px] font-medium hover:bg-red-50"
                        >
                          <XCircle size={12} /> Anular
                        </button>
                      </div>
                    )}

                    {/* Historial de movimientos */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                        Movimientos ({(inst.movimientos || []).length})
                      </h3>
                      {(!inst.movimientos || inst.movimientos.length === 0) ? (
                        <p className="text-xs text-gray-400 italic">Sin movimientos registrados</p>
                      ) : (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {[...inst.movimientos].reverse().map((m, i) => (
                            <div key={m.fecha || `mov-${i}`} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-xs">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.tipo === "uso" ? "bg-red-100" : "bg-green-100"}`}>
                                {m.tipo === "uso" ? <TrendingDown size={12} className="text-red-600" /> : <TrendingUp size={12} className="text-green-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-700">{m.concepto || (m.tipo === "uso" ? "Uso" : "Abono")}</span>
                                {m.referencia && <span className="text-gray-400 ml-2">Ref: {m.referencia}</span>}
                              </div>
                              <span className={`font-bold ${m.tipo === "uso" ? "text-red-600" : "text-green-600"}`}>
                                {m.tipo === "uso" ? "-" : "+"}{monedaSym}{fmt(m.monto)}
                              </span>
                              <span className="text-gray-400 text-[10px] flex-shrink-0">
                                {m.fecha ? new Date(m.fecha).toLocaleDateString("es-PE") : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Los instrumentos financieros permiten gestionar saldos de CIPRL, cartas fianza y otros medios de pago especiales.
      </p>

      {/* Modales */}
      {modalCrear && (
        <ModalCrear
          email={email}
          onClose={() => setModalCrear(false)}
          onCreado={() => { setModalCrear(false); cargar(); }}
        />
      )}
      {modalMov && (
        <ModalMovimiento
          instrumento={modalMov.instrumento}
          tipo={modalMov.tipo}
          email={email}
          onClose={() => setModalMov(null)}
          onGuardado={() => { setModalMov(null); cargar(); }}
        />
      )}
    </div>
  );
}
