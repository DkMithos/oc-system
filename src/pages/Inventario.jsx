// src/pages/Inventario.jsx
import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { Package, Plus, Pencil, X, Download, Search } from "lucide-react";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import {
  escucharItemsInventario,
  agregarItemInventario,
  actualizarItemInventario,
  desactivarItemInventario,
  CATEGORIAS_INVENTARIO,
  UNIDADES_INVENTARIO,
} from "../firebase/inventarioHelpers";

const POR_PAGINA = 20;

const selectStyles = {
  control: (b) => ({ ...b, minHeight: 36, borderColor: "#d1d5db", boxShadow: "none", fontSize: 14 }),
  valueContainer: (b) => ({ ...b, padding: "2px 8px" }),
  indicatorsContainer: (b) => ({ ...b, height: 34 }),
  menu: (b) => ({ ...b, zIndex: 50, fontSize: 14 }),
  menuPortal: (b) => ({ ...b, zIndex: 9999 }),
};

const FORM_INICIAL = {
  codigo: "", nombre: "", descripcion: "", categoria: "",
  unidad: "UND", centroCostoId: "", centroCostoNombre: "",
  precioReferencia: "", activo: true,
};

const Inventario = () => {
  const { usuario } = useUsuario();

  const [items, setItems] = useState([]);
  const [centros, setCentros] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  // Paginación
  const [pagina, setPagina] = useState(1);

  // Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // ── Carga inicial + listener en tiempo real ──────────────────
  useEffect(() => {
    // Centros de costo: carga única (no cambian frecuentemente)
    obtenerCentrosCosto()
      .then((cc) => setCentros((cc || []).map((c) => ({ value: c.id, label: c.nombre }))))
      .catch(console.error);

    // [F-05] Inventario en tiempo real con onSnapshot
    setCargando(true);
    const unsub = escucharItemsInventario((lista) => {
      setItems(lista || []);
      setCargando(false);
    });
    return () => unsub(); // cleanup al desmontar
  }, []);

  // ── Filtrado ─────────────────────────────────────────────────
  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((i) => {
      if (!mostrarInactivos && i.activo === false) return false;
      if (filtroCat && i.categoria !== filtroCat) return false;
      if (filtroCentro && i.centroCostoId !== filtroCentro) return false;
      if (q) {
        const texto = `${i.codigo} ${i.nombre} ${i.categoria} ${i.centroCostoNombre}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [items, busqueda, filtroCat, filtroCentro, mostrarInactivos]);

  useEffect(() => setPagina(1), [busqueda, filtroCat, filtroCentro, mostrarInactivos]);

  const totalPaginas = Math.max(1, Math.ceil(itemsFiltrados.length / POR_PAGINA));
  const itemsPagina = itemsFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // ── Acciones ─────────────────────────────────────────────────
  const abrirNuevo = () => {
    setForm(FORM_INICIAL);
    setEditandoId(null);
    setMostrarForm(true);
  };

  const abrirEditar = (item) => {
    setForm({
      codigo: item.codigo || "",
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      categoria: item.categoria || "",
      unidad: item.unidad || "UND",
      centroCostoId: item.centroCostoId || "",
      centroCostoNombre: item.centroCostoNombre || "",
      precioReferencia: item.precioReferencia ?? "",
      activo: item.activo !== false,
    });
    setEditandoId(item.id);
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.warning("El nombre del ítem es requerido.");
    if (!form.categoria) return toast.warning("Selecciona una categoría.");
    if (!form.unidad) return toast.warning("Selecciona una unidad.");
    setGuardando(true);
    try {
      const payload = {
        ...form,
        precioReferencia: form.precioReferencia !== "" ? Number(form.precioReferencia) : null,
        creadoPor: usuario?.email || "",
      };
      if (editandoId) {
        await actualizarItemInventario(editandoId, payload);
        toast.success("Ítem actualizado ✅");
      } else {
        await agregarItemInventario(payload);
        toast.success("Ítem registrado ✅");
      }
      setMostrarForm(false);
      setForm(FORM_INICIAL);
      setEditandoId(null);
      // onSnapshot actualiza automáticamente — no hace falta llamar a cargar()
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el ítem.");
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (item) => {
    if (!confirm(`¿Desactivar "${item.nombre}"? Podrás reactivarlo editándolo.`)) return;
    try {
      await desactivarItemInventario(item.id);
      toast.success("Ítem desactivado.");
      // onSnapshot actualiza automáticamente
    } catch (e) {
      toast.error("Error al desactivar.");
    }
  };

  const exportar = () => {
    if (!itemsFiltrados.length) return toast.warning("No hay datos para exportar.");
    const rows = itemsFiltrados.map((i) => ({
      Código: i.codigo || "",
      Nombre: i.nombre || "",
      Categoría: i.categoria || "",
      Unidad: i.unidad || "",
      "Centro de Costo": i.centroCostoNombre || "",
      Descripción: i.descripcion || "",
      "Precio Ref.": i.precioReferencia ?? "",
      Estado: i.activo !== false ? "Activo" : "Inactivo",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 8 }, { wch: 22 }, { wch: 40 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Exportado ✅");
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg"><Package className="text-blue-600" size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-500">Gestión de ítems estandarizados por centro de costo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-600 text-green-700 hover:bg-green-50 text-sm font-medium">
            <Download size={16} /> Exportar
          </button>
          <button onClick={abrirNuevo} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
            <Plus size={16} /> Nuevo ítem
          </button>
        </div>
      </div>

      {/* Formulario (inline) */}
      {mostrarForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{editandoId ? "Editar ítem" : "Nuevo ítem"}</h2>
            <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código <span className="text-gray-400 font-normal">(auto si vacío)</span></label>
              <input className="border rounded-lg p-2 w-full text-sm" placeholder="Ej: HM-001" value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input className="border rounded-lg p-2 w-full text-sm" placeholder="Descripción del ítem" value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría <span className="text-red-500">*</span></label>
              <select className="border rounded-lg p-2 w-full text-sm" value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Selecciona...</option>
                {CATEGORIAS_INVENTARIO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad <span className="text-red-500">*</span></label>
              <select className="border rounded-lg p-2 w-full text-sm" value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                {UNIDADES_INVENTARIO.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
              <Select
                styles={selectStyles}
                menuPortalTarget={document.body}
                options={centros}
                isClearable
                placeholder="Selecciona..."
                value={form.centroCostoId ? centros.find((c) => c.value === form.centroCostoId) || null : null}
                onChange={(op) => setForm({ ...form, centroCostoId: op?.value || "", centroCostoNombre: op?.label || "" })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio de referencia</label>
              <input type="number" min={0} className="border rounded-lg p-2 w-full text-sm text-right" placeholder="0.00"
                value={form.precioReferencia} onChange={(e) => setForm({ ...form, precioReferencia: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea className="border rounded-lg p-2 w-full text-sm" rows={2} placeholder="Detalle adicional (opcional)"
                value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="activoCheck" checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              <label htmlFor="activoCheck" className="text-sm text-gray-700">Activo</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setMostrarForm(false)} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
              {guardando ? "Guardando..." : editandoId ? "Actualizar" : "Registrar"}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="border rounded-lg pl-8 pr-3 py-2 w-full text-sm" placeholder="Buscar código, nombre, categoría..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <select className="border rounded-lg px-3 py-2 text-sm" value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS_INVENTARIO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm" value={filtroCentro}
            onChange={(e) => setFiltroCentro(e.target.value)}>
            <option value="">Todos los centros de costo</option>
            {centros.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            Mostrar inactivos
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código","Nombre","Categoría","Unidad","Centro de Costo","Precio Ref.","Estado","Acciones"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando inventario…</td></tr>
            )}
            {!cargando && itemsPagina.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                No se encontraron ítems. {!mostrarForm && <button onClick={abrirNuevo} className="text-blue-600 underline ml-1">Agregar uno</button>}
              </td></tr>
            )}
            {!cargando && itemsPagina.map((item, idx) => (
              <tr key={item.id} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
                <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{item.codigo || "—"}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{item.nombre}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{item.categoria || "—"}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.unidad || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{item.centroCostoNombre || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {item.precioReferencia != null ? `S/ ${Number(item.precioReferencia).toFixed(2)}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {item.activo !== false
                    ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Activo</span>
                    : <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">Inactivo</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => abrirEditar(item)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600" title="Editar"><Pencil size={14} /></button>
                    {item.activo !== false && (
                      <button onClick={() => desactivar(item)} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Desactivar"><X size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!cargando && itemsFiltrados.length > POR_PAGINA && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Mostrando {((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, itemsFiltrados.length)} de {itemsFiltrados.length}</span>
          <div className="flex items-center gap-1">
            {[["«",1],["‹",pagina-1]].map(([l,p]) => (
              <button key={l} onClick={() => setPagina(Math.max(1,p))} disabled={pagina===1}
                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">{l}</button>
            ))}
            <span className="px-3 py-1 rounded border bg-blue-600 text-white">{pagina}</span>
            {[["›",pagina+1],["»",totalPaginas]].map(([l,p]) => (
              <button key={l} onClick={() => setPagina(Math.min(totalPaginas,p))} disabled={pagina===totalPaginas}
                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* Resumen */}
      {!cargando && (
        <p className="text-xs text-gray-400 text-center">
          {items.filter(i => i.activo !== false).length} ítems activos · {items.filter(i => i.activo === false).length} inactivos · {new Set(items.map(i => i.categoria)).size} categorías
        </p>
      )}
    </div>
  );
};

export default Inventario;
