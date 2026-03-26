// src/pages/Requerimientos.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  agregarRequerimiento,
  obtenerRequerimientosPorRol,
  generarCodigoRequerimiento,
  actualizarEstadoRequerimiento,
} from "../firebase/requerimientosHelpers";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import { PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useUsuario } from "../context/UsuarioContext";
import Select from "react-select";
import { toast } from "react-toastify";

// Roles que pueden CREAR requerimientos
const ROLES_CREAR = ["admin", "comprador", "operaciones"];
// Roles que pueden APROBAR/RECHAZAR requerimientos
const ROLES_APROBAR = ["admin", "operaciones", "gerencia operaciones", "gerencia general", "gerencia"];

const ESTADOS_REQUERIMIENTO = ["Pendiente", "En revisión", "Aprobado", "Rechazado", "Atendido"];

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 38,
    borderColor: "#d1d5db",
    boxShadow: "none",
    ":hover": { borderColor: "#9ca3af" },
    fontSize: 14,
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 34 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

const badgeEstado = (estado) => {
  const map = {
    "Pendiente": "bg-yellow-100 text-yellow-800",
    "En revisión": "bg-blue-100 text-blue-800",
    "Aprobado": "bg-green-100 text-green-800",
    "Rechazado": "bg-red-100 text-red-800",
    "Atendido": "bg-gray-100 text-gray-600",
  };
  return map[estado] || "bg-gray-100 text-gray-600";
};

const Requerimientos = () => {
  const { usuario, cargando } = useUsuario();
  const rol = String(usuario?.rol || "").toLowerCase().trim();

  const puedeCrear = ROLES_CREAR.includes(rol);
  const puedeAprobar = ROLES_APROBAR.includes(rol);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");

  const [centrosOptions, setCentrosOptions] = useState([]);
  const [centrosLoading, setCentrosLoading] = useState(true);
  const [requerimientos, setRequerimientos] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const [form, setForm] = useState({
    codigo: "",
    fecha: new Date().toISOString().split("T")[0],
    solicitante: "",
    centroCosto: "",
    centroCostoId: "",
    detalle: "",
    items: [],
  });

  const [itemActual, setItemActual] = useState({ nombre: "", cantidad: 1, unidad: "" });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  // Carga centros de costo
  useEffect(() => {
    if (cargando || !usuario) return;
    let alive = true;
    (async () => {
      setCentrosLoading(true);
      try {
        const centros = await obtenerCentrosCosto();
        if (!alive) return;
        const options = (centros || [])
          .filter((c) => !!c?.nombre)
          .map((c) => ({ value: c.id, label: c.nombre }));
        setCentrosOptions(options);
      } catch (e) {
        console.error("Error cargando centros de costo:", e);
        setCentrosOptions([]);
      } finally {
        if (alive) setCentrosLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cargando, usuario]);

  // Carga requerimientos según rol
  const cargarRequerimientos = async () => {
    if (!usuario?.email) return;
    setCargandoLista(true);
    try {
      const lista = await obtenerRequerimientosPorRol(usuario.email, usuario.rol);
      lista.sort((a, b) => String(b.fechaCreacion?.seconds || b.creadoEn || "").localeCompare(String(a.fechaCreacion?.seconds || a.creadoEn || "")));
      setRequerimientos(lista || []);
    } catch (e) {
      console.error("Error cargando requerimientos:", e);
      toast.error("No se pudieron cargar los requerimientos.");
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => {
    if (cargando || !usuario?.email) return;
    (async () => {
      try {
        const cod = await generarCodigoRequerimiento();
        setForm((prev) => ({ ...prev, codigo: cod, solicitante: usuario.email }));
      } catch {
        setForm((prev) => ({ ...prev, solicitante: usuario.email }));
      }
      await cargarRequerimientos();
    })();
  }, [cargando, usuario?.email]);

  const requerimientosFiltrados = useMemo(() => {
    const q = (busqueda || "").toLowerCase().trim();
    return (requerimientos || []).filter((r) => {
      const texto = `${r.codigo || ""} ${r.detalle || ""} ${r.usuario || ""}`.toLowerCase();
      const matchTexto = !q || texto.includes(q);
      const matchEstado = filtroEstado ? r.estado === filtroEstado : true;
      const matchCentro = filtroCentro
        ? (r.centroCosto || "").toLowerCase().includes(filtroCentro.toLowerCase())
        : true;
      return matchTexto && matchEstado && matchCentro;
    });
  }, [requerimientos, busqueda, filtroEstado, filtroCentro]);

  const exportarExcel = () => {
    if (!requerimientosFiltrados.length) {
      toast.warning("No hay datos para exportar");
      return;
    }
    const data = requerimientosFiltrados.map((r) => ({
      Código: r.codigo,
      Fecha: r.fecha,
      Solicitante: r.usuario || r.creadoPor,
      "Centro de Costo": r.centroCosto,
      Detalle: r.detalle,
      "Cantidad de Ítems": (r.items || []).length,
      Estado: r.estado,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requerimientos");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Requerimientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const agregarItem = () => {
    if (!itemActual.nombre || !itemActual.unidad || Number(itemActual.cantidad) <= 0) {
      toast.warning("Completa los datos del ítem");
      return;
    }
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...itemActual, cantidad: Number(itemActual.cantidad) }] }));
    setItemActual({ nombre: "", cantidad: 1, unidad: "" });
  };

  const validarForm = () => {
    if (!form.codigo) return "Falta el código.";
    if (!form.centroCosto) return "Selecciona un centro de costo.";
    if (!form.items.length) return "Agrega al menos un ítem.";
    return null;
  };

  const guardar = async () => {
    let codigo = form.codigo;
    if (!codigo) {
      try {
        codigo = await generarCodigoRequerimiento();
      } catch {
        codigo = `RQ-${Date.now()}`;
      }
      setForm((prev) => ({ ...prev, codigo }));
    }
    const v = validarForm();
    if (v) { toast.warning(v); return; }

    const nuevo = {
      ...form,
      codigo,
      estado: "Pendiente",
      centroCosto: form.centroCosto,
      centroCostoId: form.centroCostoId || null,
      usuario: usuario.email,
      creadoPor: usuario.email,
      creadoEn: new Date().toISOString(),
    };

    try {
      await agregarRequerimiento(nuevo);
      toast.success("Requerimiento guardado ✅");
      const next = await generarCodigoRequerimiento().catch(() => `RQ-${Date.now()}`);
      setForm({ codigo: next, fecha: new Date().toISOString().split("T")[0], solicitante: usuario.email, centroCosto: "", centroCostoId: "", detalle: "", items: [] });
      setMostrarFormulario(false);
      await cargarRequerimientos();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el requerimiento.");
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await actualizarEstadoRequerimiento(id, nuevoEstado, usuario.email);
      toast.success(`Estado actualizado a "${nuevoEstado}"`);
      await cargarRequerimientos();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el estado.");
    }
  };

  if (cargando) return <div className="p-6">Cargando usuario…</div>;
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Requerimientos de Compra</h2>
        <div className="flex gap-2">
          {puedeCrear && (
            <button
              onClick={() => setMostrarFormulario((v) => !v)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              {mostrarFormulario ? "Cancelar" : "+ Nuevo Requerimiento"}
            </button>
          )}
          <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Formulario (solo roles que pueden crear) */}
      {puedeCrear && mostrarFormulario && (
        <div className="bg-white p-6 rounded shadow mb-6 border border-blue-100">
          <h3 className="font-semibold text-lg mb-4">Nuevo Requerimiento</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Código</label>
              <input type="text" value={form.codigo} readOnly className="border p-2 rounded w-full bg-gray-50" placeholder="Generando…" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de Emisión</label>
              <input type="date" disabled value={form.fecha} className="border p-2 rounded w-full bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Centro de Costo *</label>
              <Select
                styles={selectStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                options={centrosOptions}
                isLoading={centrosLoading}
                isClearable
                isSearchable
                placeholder={centrosLoading ? "Cargando..." : "Selecciona..."}
                value={form.centroCosto ? { value: form.centroCostoId, label: form.centroCosto } : null}
                onChange={(op) => setForm((prev) => ({ ...prev, centroCosto: op?.label || "", centroCostoId: op?.value || "" }))}
                noOptionsMessage={() => centrosLoading ? "Cargando..." : "No hay centros de costo"}
              />
            </div>
            <div className="md:col-span-3">
              <input
                type="text"
                placeholder="Detalle del requerimiento (opcional)"
                value={form.detalle}
                onChange={(e) => setForm({ ...form, detalle: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>

            {/* Tabla de ítems */}
            <div className="md:col-span-3">
              <p className="font-semibold mb-2">Ítems del Requerimiento</p>
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 border text-left">Ítem</th>
                      <th className="p-2 border text-center">Cantidad</th>
                      <th className="p-2 border text-center">Unidad</th>
                      <th className="p-2 border text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 border">
                          <input type="text" value={item.nombre}
                            onChange={(e) => { const n = [...form.items]; n[i].nombre = e.target.value; setForm({ ...form, items: n }); }}
                            className="border rounded px-2 py-1 w-full" />
                        </td>
                        <td className="p-2 border text-center">
                          <input type="number" min={1} value={item.cantidad}
                            onChange={(e) => { const n = [...form.items]; n[i].cantidad = parseInt(e.target.value || "0", 10); setForm({ ...form, items: n }); }}
                            className="border rounded px-2 py-1 w-20 text-right" />
                        </td>
                        <td className="p-2 border text-center">
                          <input type="text" value={item.unidad}
                            onChange={(e) => { const n = [...form.items]; n[i].unidad = e.target.value; setForm({ ...form, items: n }); }}
                            className="border rounded px-2 py-1 w-24 text-center" />
                        </td>
                        <td className="p-2 border text-center">
                          <button onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))}
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Fila de nuevo ítem */}
                    <tr className="border-t bg-gray-50">
                      <td className="p-2 border">
                        <input type="text" placeholder="Ítem" value={itemActual.nombre}
                          onChange={(e) => setItemActual({ ...itemActual, nombre: e.target.value })}
                          className="border rounded px-2 py-1 w-full" />
                      </td>
                      <td className="p-2 border text-center">
                        <input type="number" min={1} value={itemActual.cantidad}
                          onChange={(e) => setItemActual({ ...itemActual, cantidad: parseInt(e.target.value || "0", 10) })}
                          className="border rounded px-2 py-1 w-20 text-right" />
                      </td>
                      <td className="p-2 border text-center">
                        <input type="text" placeholder="UND" value={itemActual.unidad}
                          onChange={(e) => setItemActual({ ...itemActual, unidad: e.target.value })}
                          className="border rounded px-2 py-1 w-24 text-center" />
                      </td>
                      <td className="p-2 border text-center">
                        <button onClick={agregarItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">
                          <PlusCircle size={16} />
                        </button>
                      </td>
                    </tr>

                    {form.items.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-gray-400 p-3 text-sm">Sin ítems. Agrega al menos uno.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2">
              <button onClick={() => setMostrarFormulario(false)} className="text-sm border px-4 py-2 rounded hover:bg-gray-50">Cancelar</button>
              <button onClick={guardar} className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Guardar Requerimiento</button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por código, detalle o usuario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded flex-1 min-w-[200px]"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_REQUERIMIENTO.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          type="text"
          placeholder="Centro de costo..."
          value={filtroCentro}
          onChange={(e) => setFiltroCentro(e.target.value)}
          className="border p-2 rounded w-48"
        />
      </div>

      {/* Tabla */}
      <h3 className="text-lg font-semibold mb-2">
        Requerimientos Registrados
        <span className="ml-2 text-sm font-normal text-gray-500">({requerimientosFiltrados.length})</span>
      </h3>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Solicitante</th>
              <th className="p-2 text-left">Centro</th>
              <th className="p-2 text-left">Detalle</th>
              <th className="p-2 text-center">Ítems</th>
              <th className="p-2 text-center">Estado</th>
              {puedeAprobar && <th className="p-2 text-center">Acción</th>}
            </tr>
          </thead>
          <tbody>
            {cargandoLista ? (
              <tr><td colSpan={8} className="text-center text-gray-400 p-4">Cargando…</td></tr>
            ) : requerimientosFiltrados.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 p-4">Sin resultados.</td></tr>
            ) : (
              requerimientosFiltrados.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{r.codigo}</td>
                  <td className="p-2">{r.fecha}</td>
                  <td className="p-2 text-xs">{r.usuario || r.creadoPor || "—"}</td>
                  <td className="p-2 text-xs">{r.centroCosto}</td>
                  <td className="p-2 text-xs max-w-[200px] truncate">{r.detalle}</td>
                  <td className="p-2 text-center">{(r.items || []).length}</td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeEstado(r.estado)}`}>
                      {r.estado || "Sin estado"}
                    </span>
                  </td>
                  {puedeAprobar && (
                    <td className="p-2 text-center">
                      {r.estado === "Pendiente" && (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => cambiarEstado(r.id, "Aprobado")}
                            className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                          >Aprobar</button>
                          <button
                            onClick={() => cambiarEstado(r.id, "Rechazado")}
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                          >Rechazar</button>
                        </div>
                      )}
                      {r.estado === "En revisión" && (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => cambiarEstado(r.id, "Aprobado")}
                            className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                          >Aprobar</button>
                          <button
                            onClick={() => cambiarEstado(r.id, "Rechazado")}
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                          >Rechazar</button>
                        </div>
                      )}
                      {!["Pendiente", "En revisión"].includes(r.estado) && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Requerimientos;
