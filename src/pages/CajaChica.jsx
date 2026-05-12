// src/pages/CajaChica.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import {
  AREAS_CAJA,
  MONEDAS_CAJA,
  crearMovimientoCaja,
  obtenerTiposDocumento,
  subirArchivoCaja,
  obtenerEstadoCajaActual,
  abrirCaja,
  cerrarCaja,
  filtrarMovsPorPeriodo,
  onMovimientosPorCaja,
  getContadorActual,
  getAreaConfig,
  getMonedaConfig,
  asegurarContadoresIniciales,
} from "../firebase/cajaChicaHelpers";

// ─── Permisos por rol ─────────────────────────────────────────
const normalizaRol = (rol) => String(rol || "").trim().toLowerCase();

const areasPorRol = (rol) => {
  const r = normalizaRol(rol);
  if (r === "operaciones") return ["operaciones"];
  if (r === "administracion" || r === "administración") return ["administracion"];
  if (["gerencia operaciones", "gerencia de operaciones", "admin", "soporte",
       "gerencia", "gerencia general", "gerencia finanzas"].includes(r))
    return AREAS_CAJA.map((a) => a.id);
  return [];
};

const cajasPorRol = (rol) =>
  areasPorRol(rol).flatMap((a) => MONEDAS_CAJA.map((m) => `${a}-${m.id}`));

const areaDefecto = (rol) => {
  const r = normalizaRol(rol);
  if (r === "operaciones") return "operaciones";
  if (r === "administracion" || r === "administración") return "administracion";
  return "proyectos";
};

// ─── Estilos react-select ─────────────────────────────────────
const selectStyles = {
  control: (b) => ({ ...b, minHeight: 38, borderColor: "#d1d5db", boxShadow: "none", ":hover": { borderColor: "#9ca3af" }, fontSize: 14 }),
  valueContainer: (b) => ({ ...b, padding: "2px 8px" }),
  indicatorsContainer: (b) => ({ ...b, height: 34 }),
  menuPortal: (b) => ({ ...b, zIndex: 9999 }),
  menu: (b) => ({ ...b, zIndex: 9999 }),
};

// ─── Popover filtros ──────────────────────────────────────────
const Popover = ({ open, onClose, anchorRef, children }) => {
  if (!open) return null;
  const rect = anchorRef?.current?.getBoundingClientRect?.();
  const style = rect
    ? { position: "fixed", top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 360), width: 340, zIndex: 10000 }
    : { position: "fixed", top: 80, right: 24, width: 340, zIndex: 10000 };
  return (
    <div className="bg-white rounded-lg shadow-xl border p-3" style={style}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Filtros avanzados</h4>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Cerrar</button>
      </div>
      {children}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────
const CajaChica = () => {
  const { usuario, cargando } = useUsuario();
  const rol = usuario?.rol || "";

  const areasPermitidas = useMemo(() => areasPorRol(rol), [rol]);
  const puedeVerTodasAreas = areasPermitidas.length > 1;

  // Selección de área y moneda
  const [area, setArea]     = useState(() => areaDefecto(rol));
  const [monedaId, setMonedaId] = useState("soles");

  // Si el rol cambia y el área actual no está permitida, corregir
  useEffect(() => {
    if (!areasPermitidas.includes(area)) {
      setArea(areaDefecto(rol));
    }
  }, [areasPermitidas, rol]); // eslint-disable-line

  const cajaId = useMemo(() => `${area}-${monedaId}`, [area, monedaId]);
  const areaConfig  = useMemo(() => AREAS_CAJA.find((a) => a.id === area) || AREAS_CAJA[2], [area]);
  const monedaConf  = useMemo(() => MONEDAS_CAJA.find((m) => m.id === monedaId) || MONEDAS_CAJA[0], [monedaId]);
  const simbolo     = monedaConf.simbolo;

  const fileInputRef = useRef(null);
  const btnFiltroRef = useRef(null);

  // Catálogos
  const [centros, setCentros]   = useState([]);
  const [tiposDoc, setTiposDoc] = useState([]);

  // Estado de caja
  const [estadoCaja, setEstadoCaja]     = useState(null);
  const [loadingEstado, setLoadingEstado] = useState(true);
  const [nextNumero, setNextNumero]     = useState(null); // siguiente número de caja

  // Movimientos (realtime)
  const [movs, setMovs]               = useState([]);
  const [cargandoMovs, setCargandoMovs] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 20;

  // Búsqueda / filtros
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({
    tipo: "", tipoDocumentoId: "", centroCostoId: "",
    fechaDesde: "", fechaHasta: "", minMonto: "", maxMonto: "", creadoPorEmail: "",
  });
  const [openFilters, setOpenFilters] = useState(false);

  // Formulario de movimiento
  const formInicial = () => ({
    tipo: "Egreso",
    monto: "",
    fecha: new Date().toISOString().slice(0, 10),
    centroCostoId: "",
    centroCostoNombre: "",
    razonSocial: "",
    tipoDocumentoId: "",
    tipoDocumentoNombre: "",
    comprobante: "",
    descripcion: "",
    archivoFile: null,
  });
  const [form, setForm] = useState(formInicial);

  // Apertura / cierre
  const [saldoInicialInput, setSaldoInicialInput] = useState("");
  const [saldoCierreInput, setSaldoCierreInput]   = useState("");

  // ── Catálogos + inicialización de contadores ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cent, tipos] = await Promise.all([
          obtenerCentrosCosto().catch(() => []),
          obtenerTiposDocumento().catch(() => []),
          asegurarContadoresIniciales().catch(() => {}), // una sola vez
        ]);
        if (!alive) return;
        setCentros((cent || []).filter((c) => !!c?.nombre).map((c) => ({ value: c.id, label: c.nombre })));
        setTiposDoc((tipos || []).filter((t) => !!t?.nombre).map((t) => ({ value: t.id, label: t.nombre })));
      } catch (e) { console.error(e); }
    })();
    return () => { alive = false; };
  }, []);

  // ── Estado de caja ──
  const cargarEstadoCaja = async (id = cajaId) => {
    setLoadingEstado(true);
    try {
      const [est, num] = await Promise.all([
        obtenerEstadoCajaActual(id),
        getContadorActual(id),
      ]);
      setEstadoCaja(est);
      setNextNumero(num + 1);
    } catch (e) {
      console.error("Estado caja:", e);
      setEstadoCaja(null);
    } finally {
      setLoadingEstado(false);
    }
  };

  // ── Movimientos realtime ──
  useEffect(() => {
    if (!usuario || cargando || !cajaId) return;
    setCargandoMovs(true);
    setMovs([]);
    const unsub = onMovimientosPorCaja(cajaId, (list) => {
      setMovs(list || []);
      setCargandoMovs(false);
    });
    return () => unsub && unsub();
  }, [usuario?.email, cargando, cajaId]);

  // ── Cargar estado cuando cambia cajaId ──
  useEffect(() => {
    if (!usuario || cargando || !cajaId) return;
    cargarEstadoCaja(cajaId);
    setQ("");
    setFiltros({ tipo: "", tipoDocumentoId: "", centroCostoId: "", fechaDesde: "", fechaHasta: "", minMonto: "", maxMonto: "", creadoPorEmail: "" });
  }, [usuario?.email, cargando, cajaId]); // eslint-disable-line

  // ── Sugerir saldo cierre ──
  useEffect(() => {
    if (estadoCaja?.abierta) setSaldoCierreInput((kpis.saldoActual ?? 0).toFixed(2));
  }, [estadoCaja?.abierta, estadoCaja]); // eslint-disable-line

  // ── KPIs ──
  const movsPeriodo = useMemo(() => filtrarMovsPorPeriodo(movs, estadoCaja), [movs, estadoCaja]);

  const kpis = useMemo(() => {
    const ingresos    = movsPeriodo.filter((m) => m.tipo === "Ingreso").reduce((a, m) => a + Number(m.monto || 0), 0);
    const egresos     = movsPeriodo.filter((m) => m.tipo === "Egreso").reduce((a, m) => a + Number(m.monto || 0), 0);
    const saldoInicial = Number(estadoCaja?.aperturaSaldoInicial || 0);
    return { ingresos, egresos, saldoInicial, saldoActual: saldoInicial + ingresos - egresos };
  }, [movsPeriodo, estadoCaja]);

  // ── Filtrado ──
  const movsFiltrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const matchTexto = (m) => !texto || [
      m.tipo, m.monto, m.fechaISO, m.centroCostoNombre, m.razonSocial,
      m.tipoDocumentoNombre, m.comprobante, m.descripcion, m.creadoPorEmail,
    ].map((x) => String(x || "").toLowerCase()).join(" ").includes(texto);

    const matchFiltro = (m) => {
      if (filtros.tipo && m.tipo !== filtros.tipo) return false;
      if (filtros.tipoDocumentoId && m.tipoDocumentoId !== filtros.tipoDocumentoId) return false;
      if (filtros.centroCostoId && m.centroCostoId !== filtros.centroCostoId) return false;
      if (filtros.creadoPorEmail && m.creadoPorEmail !== filtros.creadoPorEmail) return false;
      if (filtros.fechaDesde && String(m.fechaISO) < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && String(m.fechaISO) > filtros.fechaHasta) return false;
      const monto = Number(m.monto || 0);
      if (filtros.minMonto && monto < Number(filtros.minMonto)) return false;
      if (filtros.maxMonto && monto > Number(filtros.maxMonto)) return false;
      return true;
    };

    return (movsPeriodo || [])
      .filter((m) => matchTexto(m) && matchFiltro(m))
      .sort((a, b) => String(b.fechaISO || "").localeCompare(String(a.fechaISO || "")));
  }, [movsPeriodo, q, filtros]);

  useEffect(() => { setPagina(1); }, [q, filtros, cajaId]);

  const totalPaginas = Math.max(1, Math.ceil(movsFiltrados.length / POR_PAGINA));
  const movsPagina   = movsFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // ── Validación / guardado ──
  const validar = () => {
    if (!form.tipo)                       return "Selecciona Ingreso o Egreso.";
    if (!form.monto || Number(form.monto) <= 0) return "Monto inválido.";
    if (!form.fecha)                      return "Fecha requerida.";
    if (!form.centroCostoId)              return "Selecciona un Centro de Costo.";
    if (!form.razonSocial.trim())         return "Ingresa la Razón Social.";
    if (!form.tipoDocumentoId)            return "Selecciona el Tipo de Documento.";
    if (!form.comprobante.trim())         return "Ingresa el N° de Comprobante.";
    return null;
  };

  const onGuardar = async () => {
    if (!estadoCaja?.abierta) return toast.warning("Debes abrir la caja antes de registrar movimientos.");
    const v = validar();
    if (v) return toast.info(v);
    try {
      let archivoUrl = "", archivoNombre = "";
      if (form.archivoFile) {
        const up = await subirArchivoCaja(form.archivoFile, cajaId);
        archivoUrl = up.url;
        archivoNombre = up.nombre;
      }
      await crearMovimientoCaja({
        ...form,
        cajaId,
        moneda: monedaConf.formValue,
        archivoUrl,
        archivoNombre,
        creadoPorEmail: usuario.email,
      });
      toast.success("Movimiento registrado ✅");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setForm(formInicial());
    } catch (e) {
      console.error(e);
      toast.error(e.message || "No se pudo registrar el movimiento.");
    }
  };

  // ── Apertura / Cierre ──
  const onAbrirCaja = async () => {
    const val = Number(saldoInicialInput || 0);
    if (Number.isNaN(val)) return toast.warning("Saldo inicial inválido.");
    try {
      await abrirCaja({ cajaId, saldoInicial: val, fecha: new Date().toISOString().slice(0, 10), email: usuario.email });
      await cargarEstadoCaja(cajaId);
      setSaldoInicialInput("");
      toast.success("Caja abierta ✅");
    } catch (e) { console.error(e); toast.error(e.message || "No se pudo abrir la caja."); }
  };

  const onCerrarCaja = async () => {
    const val = Number(saldoCierreInput);
    if (Number.isNaN(val)) return toast.warning("Saldo final inválido.");
    try {
      await cerrarCaja({ cajaId, saldoFinal: val, fecha: new Date().toISOString().slice(0, 10), email: usuario.email });
      await cargarEstadoCaja(cajaId);
      toast.success("Caja cerrada ✅");
    } catch (e) { console.error(e); toast.error(e.message || "No se pudo cerrar la caja."); }
  };

  // ── Exportar Excel ──
  const exportarExcel = () => {
    if (!movsFiltrados.length) { toast.warning("No hay datos para exportar."); return; }

    const codigo      = estadoCaja?.codigoCaja || `${areaConfig.prefix}---${monedaConf.sufijo}`;
    const ahora       = new Date();
    const fechaGen    = ahora.toLocaleString("es-PE");
    const pad         = (n) => String(n).padStart(2, "0");
    const codigoDesc  = `CC-${ahora.getFullYear()}${pad(ahora.getMonth()+1)}${pad(ahora.getDate())}-${pad(ahora.getHours())}${pad(ahora.getMinutes())}${pad(ahora.getSeconds())}`;

    const periodoDesde = estadoCaja?.aperturaFecha || movsFiltrados.at(-1)?.fechaISO || "";
    const periodoHasta = estadoCaja?.abierta === false && estadoCaja?.cierreFecha
      ? estadoCaja.cierreFecha
      : movsFiltrados[0]?.fechaISO || ahora.toISOString().slice(0, 10);

    const saldoInicial = Number(estadoCaja?.aperturaSaldoInicial || 0);
    const totalIng = movsFiltrados.filter((m) => m.tipo === "Ingreso").reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalEgr = movsFiltrados.filter((m) => m.tipo === "Egreso").reduce((s, m) => s + Number(m.monto || 0), 0);
    const saldoFinal = saldoInicial + totalIng - totalEgr;

    const encabezado = [
      ["MEMPHIS MAQUINARIAS SAC"],
      [`DETALLE DE CAJA CHICA ${monedaConf.sufijo}`],
      [`(Expresado en ${monedaConf.label})`],
      [`N° DE CAJA: ${codigo}`],
      [`RESPONSABLE: ${areaConfig.label.toUpperCase()}`],
      [],
      ["", "", "", "", "", "", "Saldo Inicial", saldoInicial],
      ["", "", "", "", "", "", "Ingresos",      totalIng],
      ["", "", "", "", "", "", "Gastos",        totalEgr],
      ["", "", "", "", "", "", "Saldo Final",   saldoFinal],
      [],
      ["ITEM", "CENTRO DE COSTO", "TIPO DOC", "COMPROBANTE", "RAZÓN SOCIAL",
       "DESCRIPCIÓN", `Ingreso ${simbolo}`, `Egreso ${simbolo}`, "FECHA DE PAGO"],
    ];

    let item = 1;
    const filasDatos = movsFiltrados.map((m) => [
      item++,
      m.centroCostoNombre || "",
      m.tipoDocumentoNombre || "",
      m.comprobante || "",
      m.razonSocial || "",
      m.descripcion || "",
      m.tipo === "Ingreso" ? Number(m.monto || 0) : "",
      m.tipo === "Egreso"  ? Number(m.monto || 0) : "",
      m.fechaISO || "",
    ]);

    const filaTotales = ["Total", "", "", "", "", "", totalIng, totalEgr, ""];

    const todasFilas = [...encabezado, ...filasDatos, filaTotales];
    const ws = XLSX.utils.aoa_to_sheet(todasFilas);
    ws["!cols"] = [
      { wch: 5 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 35 },
      { wch: 45 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 5 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, codigo);
    const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `${codigo}_${codigoDesc}.xlsx`);
    toast.success(`Exportado: ${movsFiltrados.length} registros — ${codigo}`);
  };

  // ── Guards ──
  if (cargando) return <div className="p-6">Cargando…</div>;
  if (!usuario || !areasPermitidas.length) return <div className="p-6 text-red-600">Acceso no autorizado</div>;

  const areasOpciones = AREAS_CAJA.filter((a) => areasPermitidas.includes(a.id));

  return (
    <div className="p-6 space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#004990]">Control de Caja Chica</h2>
          <p className="text-xs text-gray-500 mt-0.5">Rol: <b>{usuario?.rol || "—"}</b></p>
        </div>

        {/* Selector área + moneda */}
        <div className="flex items-center gap-2 flex-wrap">
          {puedeVerTodasAreas && (
            <select
              className="border rounded px-3 py-2 text-sm font-medium"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              {areasOpciones.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          )}
          {/* Toggle Soles / Dólares */}
          <div className="flex rounded border overflow-hidden text-sm font-medium">
            {MONEDAS_CAJA.map((m) => (
              <button
                key={m.id}
                onClick={() => setMonedaId(m.id)}
                className={`px-4 py-2 transition-colors ${monedaId === m.id
                  ? "bg-[#004990] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {m.simbolo} {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Badge código de caja (siempre visible) ── */}
      {!loadingEstado && (
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#004990]/5 to-[#004990]/10 border border-[#004990]/20 rounded-xl px-5 py-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mb-1">N° de Caja</span>
            <span className="font-mono font-bold text-[#004990] text-xl tracking-wide leading-none">
              {estadoCaja?.codigoCaja
                ? estadoCaja.codigoCaja
                : nextNumero
                  ? `${getAreaConfig(cajaId).prefix}${String(nextNumero).padStart(3, "0")}-${getMonedaConfig(cajaId).sufijo}`
                  : "—"}
            </span>
          </div>
          <div className="w-px h-8 bg-[#004990]/15" />
          {estadoCaja?.abierta ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-700">Abierta</span>
            </div>
          ) : estadoCaja?.cierreFecha ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs font-semibold text-gray-500">Cerrada</span>
            </div>
          ) : (
            <span className="text-xs text-amber-600 font-medium">Pendiente de apertura</span>
          )}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Saldo Inicial",   value: kpis.saldoInicial, extra: estadoCaja?.aperturaFecha ? `Apertura: ${estadoCaja.aperturaFecha}` : "Sin apertura" },
          { label: "Ingresos",        value: kpis.ingresos,     color: "text-green-700" },
          { label: "Egresos",         value: kpis.egresos,      color: "text-red-700" },
          { label: "Saldo Actual",    value: kpis.saldoActual,  color: kpis.saldoActual >= 0 ? "text-[#004990]" : "text-red-700",
            extra: !loadingEstado && estadoCaja?.abierta === false && estadoCaja?.cierreFecha ? `Cerrada: ${estadoCaja.cierreFecha}` : undefined },
        ].map(({ label, value, color = "text-gray-800", extra }) => (
          <div key={label} className="bg-white rounded-xl shadow p-4 border">
            <p className="text-xs text-gray-500">{label}</p>
            {loadingEstado
              ? <p className="text-gray-400 text-sm mt-1">Cargando…</p>
              : <p className={`text-2xl font-bold ${color}`}>{simbolo} {value.toFixed(2)}</p>}
            {extra && <p className="text-xs text-gray-400 mt-1">{extra}</p>}
          </div>
        ))}
      </div>

      {/* ── Estado de caja / apertura / cierre ── */}
      <div className="bg-white p-4 rounded shadow border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold">Estado de Caja</h3>
            {loadingEstado ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : estadoCaja?.abierta ? (
              <p className="text-sm text-green-700">
                Abierta por <b>{estadoCaja.aperturaPorEmail || "—"}</b>
                {" · "}Saldo inicial: <b>{simbolo} {Number(estadoCaja.aperturaSaldoInicial || 0).toFixed(2)}</b>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {estadoCaja?.cierreFecha ? `Cerrada el ${estadoCaja.cierreFecha}` : "Sin apertura activa."}
              </p>
            )}
          </div>

          <div className="flex items-end gap-2">
            {!estadoCaja?.abierta ? (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">Saldo inicial ({monedaConf.label})</label>
                  <input type="number" className="border rounded p-2 w-40 text-right text-sm"
                    value={saldoInicialInput} onChange={(e) => setSaldoInicialInput(e.target.value)} placeholder="0.00" />
                </div>
                <button onClick={onAbrirCaja} className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">
                  Abrir caja
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">Saldo final ({monedaConf.label})</label>
                  <input type="number" className="border rounded p-2 w-40 text-right text-sm"
                    value={saldoCierreInput} onChange={(e) => setSaldoCierreInput(e.target.value)} />
                  <p className="text-[10px] text-gray-400 mt-0.5">Sugerido = Inicial + Ingresos − Egresos</p>
                </div>
                <button onClick={onCerrarCaja} className="h-9 px-4 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm">
                  Cerrar caja
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Formulario nuevo movimiento ── */}
      <div className="bg-white p-4 rounded shadow">
        <h3 className="text-base font-semibold mb-3">
          Registrar movimiento
          <span className="ml-2 text-xs font-normal text-gray-400">({monedaConf.label} · {monedaConf.simbolo})</span>
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="border p-2 rounded w-full text-sm">
              <option>Ingreso</option>
              <option>Egreso</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monto ({simbolo})</label>
            <input type="number" min={0} value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              className="border p-2 rounded w-full text-right text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <input type="date" value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="border p-2 rounded w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Centro de Costo</label>
            <Select styles={selectStyles} menuPortalTarget={document.body}
              options={centros} isClearable isSearchable placeholder="Selecciona…"
              value={form.centroCostoId ? { value: form.centroCostoId, label: form.centroCostoNombre } : null}
              onChange={(op) => setForm({ ...form, centroCostoId: op?.value || "", centroCostoNombre: op?.label || "" })}
              noOptionsMessage={() => "Sin resultados"} />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium mb-1">Razón Social</label>
            <input type="text" value={form.razonSocial}
              onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              className="border p-2 rounded w-full text-sm" placeholder="Proveedor o colaborador" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Documento</label>
            <Select styles={selectStyles} menuPortalTarget={document.body}
              options={tiposDoc} isClearable isSearchable placeholder="Selecciona…"
              value={form.tipoDocumentoId ? { value: form.tipoDocumentoId, label: form.tipoDocumentoNombre } : null}
              onChange={(op) => setForm({ ...form, tipoDocumentoId: op?.value || "", tipoDocumentoNombre: op?.label || "" })}
              noOptionsMessage={() => "Sin resultados"} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">N° Comprobante</label>
            <input type="text" value={form.comprobante}
              onChange={(e) => setForm({ ...form, comprobante: e.target.value })}
              className="border p-2 rounded w-full text-sm" placeholder="F001-123 / S/N" />
          </div>
          <div className="lg:col-span-4">
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="border p-2 rounded w-full text-sm" rows={2}
              placeholder="Detalle del gasto / ingreso" />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium mb-1">Adjunto (opcional)</label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer border rounded px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100">
                Seleccionar archivo
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => setForm({ ...form, archivoFile: e.target.files?.[0] || null })} />
              </label>
              {form.archivoFile ? (
                <div className="flex items-center gap-1 text-sm text-gray-700 min-w-0">
                  <span className="truncate max-w-xs">{form.archivoFile.name}</span>
                  <button type="button" onClick={() => { setForm({ ...form, archivoFile: null }); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                </div>
              ) : <span className="text-xs text-gray-400">Ningún archivo</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1">PDF/JPG/PNG · Máx. 10MB</p>
          </div>
          <div className="flex items-end justify-end">
            <button onClick={onGuardar}
              className="w-full lg:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium">
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en todos los campos…"
          className="border p-2 rounded w-full md:w-1/2 text-sm" />
        <div className="flex items-center gap-2">
          <button ref={btnFiltroRef} onClick={() => setOpenFilters((s) => !s)}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">Filtros</button>
          <button onClick={exportarExcel}
            className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm">Exportar Excel</button>
        </div>

        <Popover open={openFilters} onClose={() => setOpenFilters(false)} anchorRef={btnFiltroRef}>
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">Tipo</label>
              <select value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}
                className="border p-2 rounded w-full">
                <option value="">(Todos)</option><option value="Ingreso">Ingreso</option><option value="Egreso">Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tipo de Documento</label>
              <Select styles={selectStyles} menuPortalTarget={document.body}
                options={tiposDoc} isClearable isSearchable placeholder="(Todos)"
                value={filtros.tipoDocumentoId ? tiposDoc.find((t) => t.value === filtros.tipoDocumentoId) : null}
                onChange={(op) => setFiltros((f) => ({ ...f, tipoDocumentoId: op?.value || "" }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Centro de Costo</label>
              <Select styles={selectStyles} menuPortalTarget={document.body}
                options={centros} isClearable isSearchable placeholder="(Todos)"
                value={filtros.centroCostoId ? centros.find((c) => c.value === filtros.centroCostoId) : null}
                onChange={(op) => setFiltros((f) => ({ ...f, centroCostoId: op?.value || "" }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Desde</label>
                <input type="date" value={filtros.fechaDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
                  className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hasta</label>
                <input type="date" value={filtros.fechaHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
                  className="border p-2 rounded w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Monto mín.</label>
                <input type="number" value={filtros.minMonto}
                  onChange={(e) => setFiltros((f) => ({ ...f, minMonto: e.target.value }))}
                  className="border p-2 rounded w-full" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Monto máx.</label>
                <input type="number" value={filtros.maxMonto}
                  onChange={(e) => setFiltros((f) => ({ ...f, maxMonto: e.target.value }))}
                  className="border p-2 rounded w-full" placeholder="999999" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Registrado por (email)</label>
              <input type="email" value={filtros.creadoPorEmail}
                onChange={(e) => setFiltros((f) => ({ ...f, creadoPorEmail: e.target.value }))}
                className="border p-2 rounded w-full" placeholder="usuario@empresa.com" />
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setFiltros({ tipo: "", tipoDocumentoId: "", centroCostoId: "", fechaDesde: "", fechaHasta: "", minMonto: "", maxMonto: "", creadoPorEmail: "" })}
                className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm">Limpiar</button>
              <button onClick={() => setOpenFilters(false)}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Aplicar</button>
            </div>
          </div>
        </Popover>
      </div>

      {/* ── Historial ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Tipo</th>
              <th className="p-2 border text-right">Monto ({simbolo})</th>
              <th className="p-2 border">Centro de Costo</th>
              <th className="p-2 border">Razón Social</th>
              <th className="p-2 border">Tipo Doc.</th>
              <th className="p-2 border">Comprobante</th>
              <th className="p-2 border">Descripción</th>
              <th className="p-2 border">Archivo</th>
              <th className="p-2 border">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {cargandoMovs && (
              <tr><td className="p-3 text-center text-gray-400" colSpan={10}>Cargando movimientos…</td></tr>
            )}
            {!cargandoMovs && movsFiltrados.length === 0 && (
              <tr><td className="p-3 text-center text-gray-400" colSpan={10}>Sin movimientos en este período.</td></tr>
            )}
            {!cargandoMovs && movsPagina.map((m) => (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="p-2 border whitespace-nowrap">{m.fechaISO || "—"}</td>
                <td className="p-2 border">
                  <span className={`font-medium ${m.tipo === "Ingreso" ? "text-green-700" : "text-red-700"}`}>{m.tipo}</span>
                </td>
                <td className="p-2 border text-right font-mono">
                  {simbolo} {Number(m.monto || 0).toFixed(2)}
                </td>
                <td className="p-2 border">{m.centroCostoNombre}</td>
                <td className="p-2 border">{m.razonSocial}</td>
                <td className="p-2 border">{m.tipoDocumentoNombre}</td>
                <td className="p-2 border">{m.comprobante}</td>
                <td className="p-2 border max-w-xs truncate" title={m.descripcion}>{m.descripcion}</td>
                <td className="p-2 border text-center">
                  {m.archivoUrl
                    ? <a href={m.archivoUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Ver</a>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="p-2 border text-xs text-gray-500">{m.creadoPorEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Paginación ── */}
      {!cargandoMovs && movsFiltrados.length > POR_PAGINA && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, movsFiltrados.length)} de {movsFiltrados.length}
          </span>
          <div className="flex items-center gap-1">
            {["«", "‹"].map((s, i) => (
              <button key={s} onClick={() => setPagina(i === 0 ? 1 : (p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">{s}</button>
            ))}
            <span className="px-3 py-1 rounded border bg-[#004990] text-white">{pagina}</span>
            {["›", "»"].map((s, i) => (
              <button key={s} onClick={() => setPagina(i === 0 ? (p) => Math.min(totalPaginas, p + 1) : totalPaginas)}
                disabled={pagina === totalPaginas}
                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CajaChica;
