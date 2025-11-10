// ✅ src/pages/CajaChica.jsx (MULTI-CAJA con control por rol + realtime)
import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import {
  crearMovimientoCaja,
  obtenerTiposDocumento,
  subirArchivoCaja,
  obtenerEstadoCajaActual,
  abrirCaja,
  cerrarCaja,
  filtrarMovsPorPeriodo,
  onMovimientosPorCaja,         // ⬅️ realtime
} from "../firebase/cajaChicaHelpers";

// ─────────────────────────────────────────────────────────────
const CAJAS = [
  { id: "operaciones", label: "Operaciones" },
  { id: "administracion", label: "Administración" },
  { id: "proyectos", label: "Proyectos" },
];

const normalizaRol = (rol) => String(rol || "").trim().toLowerCase();
const cajaPorDefectoRol = (rol) => {
  const r = normalizaRol(rol);
  if (r === "operaciones") return "operaciones";
  if (r === "administracion" || r === "administración") return "administracion";
  if (r === "gerencia operaciones" || r === "gerencia de operaciones") return "proyectos";
  if (r === "admin" || r === "soporte") return "proyectos";
  return "proyectos";
};
const cajasPermitidasRol = (rol) => {
  const r = normalizaRol(rol);
  if (r === "operaciones") return ["operaciones"];
  if (r === "administracion" || r === "administración") return ["administracion"];
  if (["gerencia operaciones", "gerencia de operaciones", "admin", "soporte"].includes(r))
    return CAJAS.map((c) => c.id);
  return [];
};
const puedeCambiarCajaRol = (rol) => {
  const r = normalizaRol(rol);
  return ["admin", "soporte", "gerencia operaciones", "gerencia de operaciones"].includes(r);
};

// Estilos select
const selectStyles = {
  control: (base) => ({ ...base, minHeight: 38, borderColor: "#d1d5db", boxShadow: "none", ":hover": { borderColor: "#9ca3af" }, fontSize: 14 }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 34 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

// Popover simple
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

const CajaChica = () => {
  const { usuario, cargando } = useUsuario();
  const rol = usuario?.rol || "";
  const puedeCambiarCaja = useMemo(() => puedeCambiarCajaRol(rol), [rol]);
  const permitidas = useMemo(() => cajasPermitidasRol(rol), [rol]);

  // Caja seleccionada
  const [cajaId, setCajaId] = useState(cajaPorDefectoRol(rol));

  // Datos estáticos
  const [centros, setCentros] = useState([]);
  const [tiposDoc, setTiposDoc] = useState([]);

  // Estado de caja (apertura/cierre)
  const [estadoCaja, setEstadoCaja] = useState(null);
  const [loadingEstado, setLoadingEstado] = useState(true);

  // Movimientos
  const [movs, setMovs] = useState([]);
  const [cargandoMovs, setCargandoMovs] = useState(true);

  // Búsqueda/filtrado
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({
    tipo: "",
    tipoDocumentoId: "",
    centroCostoId: "",
    fechaDesde: "",
    fechaHasta: "",
    minMonto: "",
    maxMonto: "",
    creadoPorEmail: "",
  });
  const [openFilters, setOpenFilters] = useState(false);
  const btnFiltroRef = useRef(null);

  // Formulario
  const [form, setForm] = useState({
    cajaId,
    tipo: "Ingreso",
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

  // Sincronizar caja por rol/permitidas
  useEffect(() => {
    if (!permitidas.includes(cajaId)) {
      const def = cajaPorDefectoRol(rol);
      setCajaId(def);
      setForm((f) => ({ ...f, cajaId: def }));
    }
  }, [permitidas, rol]); // eslint-disable-line

  useEffect(() => { setForm((f) => ({ ...f, cajaId })); }, [cajaId]);

  // Catálogos
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cent, tipos] = await Promise.all([
          obtenerCentrosCosto().catch(() => []),
          obtenerTiposDocumento().catch(() => []),
        ]);
        if (!alive) return;
        setCentros((cent || []).filter((c) => !!c?.nombre).map((c) => ({ value: c.id, label: c.nombre })));
        setTiposDoc((tipos || []).filter((t) => !!t?.nombre).map((t) => ({ value: t.id, label: t.nombre })));
      } catch (e) { console.error(e); }
    })();
    return () => { alive = false; };
  }, []);

  // Estado de caja (por cajaId)
  const cargarEstadoCaja = async (targetCajaId = cajaId) => {
    setLoadingEstado(true);
    try {
      const est = await obtenerEstadoCajaActual(targetCajaId);
      setEstadoCaja(est);
    } catch (e) {
      console.error("Estado caja:", e);
      setEstadoCaja(null);
    } finally {
      setLoadingEstado(false);
    }
  };

  // Suscripción a movimientos (realtime) por caja
  useEffect(() => {
    if (!usuario || cargando || !cajaId) return;
    setCargandoMovs(true);
    const unsub = onMovimientosPorCaja(cajaId, (list) => {
      setMovs(list || []);
      setCargandoMovs(false);
    });
    return () => unsub && unsub();
  }, [usuario?.email, cargando, cajaId]);

  // Cargar estado cuando cambian usuario/caja
  useEffect(() => {
    if (!usuario || cargando || !cajaId) return;
    cargarEstadoCaja(cajaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.email, cargando, cajaId]);

  // Validación y guardado
  const validar = () => {
    if (!form.tipo) return "Selecciona Ingreso o Egreso.";
    if (!form.monto || Number(form.monto) <= 0) return "Monto inválido.";
    if (!form.fecha) return "Fecha requerida.";
    if (!form.centroCostoId) return "Selecciona un Centro de Costo.";
    if (!form.razonSocial.trim()) return "Ingresa la Razón Social.";
    if (!form.tipoDocumentoId) return "Selecciona el Tipo de Documento.";
    if (!form.comprobante.trim()) return "Ingresa el Comprobante.";
    if (!form.cajaId) return "Caja inválida.";
    return null;
  };

  const onGuardar = async () => {
    try {
      if (!estadoCaja?.abierta) return alert("Debes abrir la caja antes de registrar movimientos.");
      const v = validar();
      if (v) return alert(v);

      let archivoUrl = "";
      let archivoNombre = "";
      if (form.archivoFile) {
        const up = await subirArchivoCaja(form.archivoFile, form.cajaId);
        archivoUrl = up.url;
        archivoNombre = up.nombre;
      }

      await crearMovimientoCaja({
        ...form,
        archivoUrl,
        archivoNombre,
        creadoPorEmail: usuario.email,
      });

      alert("Movimiento registrado ✅");
      setForm((prev) => ({
        ...prev,
        tipo: "Ingreso",
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
      }));
      // No hace falta recargar: onSnapshot ya refresca
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo registrar el movimiento.");
    }
  };

  // Período y filtros
  const movsPeriodo = useMemo(() => filtrarMovsPorPeriodo(movs, estadoCaja), [movs, estadoCaja]);

  const movsFiltrados = useMemo(() => {
    const texto = q.trim().toLowerCase();

    const matchesTexto = (m) => {
      if (!texto) return true;
      const plano = [
        m.tipo, m.monto, m.fechaISO, m.centroCostoNombre, m.razonSocial,
        m.tipoDocumentoNombre, m.comprobante, m.descripcion, m.creadoPorEmail,
      ].map((x) => String(x || "").toLowerCase()).join(" ");
      return plano.includes(texto);
    };

    const matchesFiltro = (m) => {
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

    const base = (movsPeriodo || []).filter((m) => matchesTexto(m) && matchesFiltro(m));
    // Orden determinista por fechaISO desc (coincide con la query)
    base.sort((a, b) => String(b.fechaISO || "").localeCompare(String(a.fechaISO || "")));
    return base;
  }, [movsPeriodo, q, filtros]);

  // KPIs
  const kpis = useMemo(() => {
    const ingresos = movsPeriodo.filter((m) => m.tipo === "Ingreso").reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const egresos = movsPeriodo.filter((m) => m.tipo === "Egreso").reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const saldoInicial = Number(estadoCaja?.aperturaSaldoInicial || 0);
    const saldoActual = saldoInicial + ingresos - egresos;
    return { ingresos, egresos, saldoInicial, saldoActual };
  }, [movsPeriodo, estadoCaja]);

  // Toolbar exportar
  const exportarExcel = () => {
    if (!movsFiltrados.length) return alert("No hay datos para exportar");
    const cajaLabel = CAJAS.find((c) => c.id === cajaId)?.label || cajaId;
    const data = movsFiltrados.map((m) => ({
      Caja: cajaLabel,
      Tipo: m.tipo,
      Monto: m.monto,
      Fecha: m.fechaISO,
      "Centro de Costo": m.centroCostoNombre,
      "Razón Social": m.razonSocial,
      "Tipo de Documento": m.tipoDocumentoNombre,
      Comprobante: m.comprobante,
      Descripción: m.descripcion,
      "Creado Por": m.creadoPorEmail,
      "Archivo Nombre": m.archivoNombre || "",
      "Archivo URL": m.archivoUrl || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CajaChica");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `CajaChica_${cajaId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Apertura / Cierre
  const [saldoInicialInput, setSaldoInicialInput] = useState("");
  const [saldoCierreInput, setSaldoCierreInput] = useState("");
  useEffect(() => {
    if (estadoCaja?.abierta) setSaldoCierreInput((kpis.saldoActual ?? 0).toFixed(2));
  }, [estadoCaja?.abierta, kpis.saldoActual]);

  const onAbrirCaja = async () => {
    try {
      const val = Number(saldoInicialInput || 0);
      if (Number.isNaN(val)) return alert("Saldo inicial inválido.");
      await abrirCaja({ cajaId, saldoInicial: val, fecha: new Date().toISOString().slice(0, 10), email: usuario.email });
      await cargarEstadoCaja(cajaId);
      setSaldoInicialInput("");
      alert("Caja abierta ✅");
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo abrir la caja.");
    }
  };

  const onCerrarCaja = async () => {
    try {
      const val = Number(saldoCierreInput);
      if (Number.isNaN(val)) return alert("Saldo final inválido.");
      await cerrarCaja({ cajaId, saldoFinal: val, fecha: new Date().toISOString().slice(0, 10), email: usuario.email });
      await cargarEstadoCaja(cajaId);
      alert("Caja cerrada ✅");
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo cerrar la caja.");
    }
  };

  if (cargando) return <div className="p-6">Cargando…</div>;
  if (!usuario || !permitidas.length) return <div className="p-6 text-red-600">Acceso no autorizado</div>;

  const opcionesCaja = CAJAS.filter((c) => permitidas.includes(c.id));

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Control de Caja Chica</h2>
          <p className="text-xs text-gray-500">Rol: <b>{usuario?.rol || "—"}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Caja:</span>
          <select className="border p-2 rounded" value={cajaId} onChange={(e) => setCajaId(e.target.value)} disabled={!puedeCambiarCaja}
            title={puedeCambiarCaja ? "Cambiar caja" : "Tu rol no puede cambiar de caja"}>
            {opcionesCaja.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-xs text-gray-500">Saldo Inicial</p>
          <p className="text-2xl font-bold">S/ {kpis.saldoInicial.toFixed(2)}</p>
          {loadingEstado ? <p className="text-xs text-gray-400 mt-1">Cargando estado…</p> :
            estadoCaja?.aperturaFecha ? <p className="text-xs text-gray-500 mt-1">Apertura: {estadoCaja.aperturaFecha}</p> :
              <p className="text-xs text-gray-400 mt-1">Sin apertura</p>}
        </div>
        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-xs text-gray-500">Ingresos</p>
          <p className="text-2xl font-bold text-green-700">S/ {kpis.ingresos.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-xs text-gray-500">Egresos</p>
          <p className="text-2xl font-bold text-red-700">S/ {kpis.egresos.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-xs text-gray-500">Saldo Actual</p>
          <p className="text-2xl font-bold">S/ {kpis.saldoActual.toFixed(2)}</p>
          {!loadingEstado && estadoCaja?.abierta === false && estadoCaja?.cierreFecha &&
            <p className="text-xs text-gray-500 mt-1">Cerrada: {estadoCaja.cierreFecha}</p>}
        </div>
      </div>

      {/* Estado de Caja */}
      <div className="bg-white p-4 rounded shadow border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold">Estado de Caja</h3>
            {loadingEstado ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : estadoCaja?.abierta ? (
              <p className="text-sm text-green-700">
                Abierta por {estadoCaja.aperturaPorEmail || "—"} (Saldo inicial: S/ {Number(estadoCaja.aperturaSaldoInicial || 0).toFixed(2)})
              </p>
            ) : (
              <p className="text-sm text-gray-600">Cerrada {estadoCaja?.cierreFecha ? `el ${estadoCaja.cierreFecha}` : ""}.</p>
            )}
          </div>

          <div className="flex items-end gap-2">
            {!estadoCaja?.abierta ? (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">Saldo inicial</label>
                  <input type="number" className="border rounded p-2 w-40 text-right"
                    value={saldoInicialInput} onChange={(e) => setSaldoInicialInput(e.target.value)} placeholder="0.00" />
                </div>
                <button onClick={onAbrirCaja} className="h-10 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white">Abrir caja</button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">Saldo final (sugerido)</label>
                  <input type="number" className="border rounded p-2 w-40 text-right"
                    value={saldoCierreInput} onChange={(e) => setSaldoCierreInput(e.target.value)} />
                  <p className="text-[11px] text-gray-500 mt-1">Sugerido = Saldo Inicial + Ingresos − Egresos</p>
                </div>
                <button onClick={onCerrarCaja} className="h-10 px-4 rounded bg-rose-600 hover:bg-rose-700 text-white">Cerrar caja</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Registrar movimiento</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="border p-2 rounded w-full">
              <option>Ingreso</option>
              <option>Egreso</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monto</label>
            <input type="number" min={0} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })}
              className="border p-2 rounded w-full text-right" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fecha (emisión)</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="border p-2 rounded w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Centro de Costo</label>
            <Select
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              options={centros}
              isClearable
              isSearchable
              placeholder="Selecciona / busca…"
              value={form.centroCostoId ? { value: form.centroCostoId, label: form.centroCostoNombre } : null}
              onChange={(op) => setForm({ ...form, centroCostoId: op?.value || "", centroCostoNombre: op?.label || "" })}
              noOptionsMessage={() => "Sin resultados"}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium mb-1">Razón Social</label>
            <input type="text" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              className="border p-2 rounded w-full" placeholder="Proveedor o colaborador" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Documento</label>
            <Select
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              options={tiposDoc}
              isClearable
              isSearchable
              placeholder="Selecciona / busca…"
              value={form.tipoDocumentoId ? { value: form.tipoDocumentoId, label: form.tipoDocumentoNombre } : null}
              onChange={(op) => setForm({ ...form, tipoDocumentoId: op?.value || "", tipoDocumentoNombre: op?.label || "" })}
              noOptionsMessage={() => "Sin resultados"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Comprobante</label>
            <input type="text" value={form.comprobante} onChange={(e) => setForm({ ...form, comprobante: e.target.value })}
              className="border p-2 rounded w-full" placeholder="Ej: F001-123456 / RH-4512 / PL-2025-09" />
          </div>
          <div className="lg:col-span-4">
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="border p-2 rounded w-full" rows={2} placeholder="Detalle del gasto/ingreso" />
          </div>
          <div className="lg:col-span-4">
            <label className="block text-sm font-medium mb-1">Adjuntar archivo (opcional)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setForm({ ...form, archivoFile: e.target.files?.[0] || null })} className="block w-full" />
            <p className="text-xs text-gray-500 mt-1">Acepta PDF/JPG/PNG. Máx 10MB.</p>
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <button onClick={onGuardar} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Guardar</button>
          </div>
        </div>
      </div>

      {/* Toolbar + Historial */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en todos los campos…"
          className="border p-2 rounded w-full md:w-1/2" />
        <div className="flex items-center gap-2">
          <button ref={btnFiltroRef} onClick={() => setOpenFilters((s) => !s)}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm" title="Filtros avanzados">Filtros</button>
          <button onClick={exportarExcel} className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm">Exportar Excel</button>
        </div>

        <Popover open={openFilters} onClose={() => setOpenFilters(false)} anchorRef={btnFiltroRef}>
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">Tipo</label>
              <select value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}
                className="border p-2 rounded w-full">
                <option value="">(Todos)</option>
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tipo de Documento</label>
              <Select styles={selectStyles} menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                options={tiposDoc} isClearable isSearchable placeholder="(Todos)"
                value={filtros.tipoDocumentoId ? tiposDoc.find((t) => t.value === filtros.tipoDocumentoId) : null}
                onChange={(op) => setFiltros((f) => ({ ...f, tipoDocumentoId: op?.value || "" }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Centro de Costo</label>
              <Select styles={selectStyles} menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                options={centros} isClearable isSearchable placeholder="(Todos)"
                value={filtros.centroCostoId ? centros.find((c) => c.value === filtros.centroCostoId) : null}
                onChange={(op) => setFiltros((f) => ({ ...f, centroCostoId: op?.value || "" }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Desde</label>
                <input type="date" value={filtros.fechaDesde} onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
                  className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hasta</label>
                <input type="date" value={filtros.fechaHasta} onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
                  className="border p-2 rounded w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Monto mín.</label>
                <input type="number" value={filtros.minMonto} onChange={(e) => setFiltros((f) => ({ ...f, minMonto: e.target.value }))}
                  className="border p-2 rounded w-full" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Monto máx.</label>
                <input type="number" value={filtros.maxMonto} onChange={(e) => setFiltros((f) => ({ ...f, maxMonto: e.target.value }))}
                  className="border p-2 rounded w-full" placeholder="999999" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Creado Por (email)</label>
              <input type="email" value={filtros.creadoPorEmail} onChange={(e) => setFiltros((f) => ({ ...f, creadoPorEmail: e.target.value }))}
                className="border p-2 rounded w-full" placeholder="usuario@empresa.com" />
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setFiltros({ tipo: "", tipoDocumentoId: "", centroCostoId: "", fechaDesde: "", fechaHasta: "", minMonto: "", maxMonto: "", creadoPorEmail: "" })}
                className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">Limpiar</button>
              <button onClick={() => setOpenFilters(false)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Aplicar</button>
            </div>
          </div>
        </Popover>
      </div>

      {/* Historial */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Tipo</th>
              <th className="p-2 border text-right">Monto</th>
              <th className="p-2 border">Centro de Costo</th>
              <th className="p-2 border">Razón Social</th>
              <th className="p-2 border">Tipo Doc.</th>
              <th className="p-2 border">Comprobante</th>
              <th className="p-2 border">Descripción</th>
              <th className="p-2 border">Archivo</th>
              <th className="p-2 border">Creado Por</th>
            </tr>
          </thead>
          <tbody>
            {cargandoMovs && (
              <tr><td className="p-3 text-center text-gray-500" colSpan={10}>Cargando movimientos…</td></tr>
            )}
            {!cargandoMovs && movsFiltrados.length === 0 && (
              <tr><td className="p-3 text-center text-gray-500" colSpan={10}>Sin resultados.</td></tr>
            )}
            {!cargandoMovs && movsFiltrados.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2 border whitespace-nowrap">{m.fechaISO || "—"}</td>
                <td className="p-2 border">{m.tipo}</td>
                <td className="p-2 border text-right">{Number(m.monto || 0).toFixed(2)}</td>
                <td className="p-2 border">{m.centroCostoNombre}</td>
                <td className="p-2 border">{m.razonSocial}</td>
                <td className="p-2 border">{m.tipoDocumentoNombre}</td>
                <td className="p-2 border">{m.comprobante}</td>
                <td className="p-2 border">{m.descripcion}</td>
                <td className="p-2 border">
                  {m.archivoUrl ? (
                    <a href={m.archivoUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline" title={m.archivoNombre || "Ver archivo"}>Ver</a>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="p-2 border">{m.creadoPorEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CajaChica;
