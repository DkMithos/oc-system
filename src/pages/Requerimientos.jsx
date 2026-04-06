// ✅ src/pages/Requerimientos.jsx (tabla de ítems con encabezados)
import React, { useState, useEffect, useMemo } from "react";
import {
  agregarRequerimiento,
  obtenerRequerimientosPorRol,
  generarCodigoRequerimiento,
  actualizarEstadoRequerimiento,
} from "../firebase/requerimientosHelpers";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import { PlusCircle } from "lucide-react";
import { useUsuario } from "../context/UsuarioContext";
import ExportMenu from "../components/ExportMenu";
import Select from "react-select";

// (Opcional) Si quieres tiempo real, habilita estas líneas y el import de db:
// import { collection, query, where, onSnapshot } from "firebase/firestore";
// import { db } from "../firebase/config";

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

const ESTADO_BADGE = {
  "Pendiente de Operaciones": "bg-amber-100 text-amber-800",
  "En Proceso":               "bg-blue-100 text-blue-800",
  "Completado":               "bg-green-100 text-green-800",
  "Rechazado":                "bg-red-100 text-red-800",
  "Cancelado":                "bg-gray-100 text-gray-600",
};

const ITEMS_POR_PAGINA = 15;

const Requerimientos = () => {
  const { usuario, cargando: loading } = useUsuario();

  const [busqueda, setBusqueda] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [pagina, setPagina] = useState(1);
  const [cambiandoEstado, setCambiandoEstado] = useState(null); // id del RQ en proceso

  const [centrosOptions, setCentrosOptions] = useState([]);
  const [centrosLoading, setCentrosLoading] = useState(true);

  const [requerimientos, setRequerimientos] = useState([]);

  const [form, setForm] = useState({
    codigo: "",
    fecha: new Date().toISOString().split("T")[0],
    solicitante: "",
    centroCosto: "",
    centroCostoId: "",
    detalle: "",
    items: [], // [{nombre, cantidad, unidad}]
  });

  const [itemActual, setItemActual] = useState({
    nombre: "",
    cantidad: 1,
    unidad: "",
  });

  // CARGA DE CENTROS
  useEffect(() => {
    if (loading || !usuario) return;
    let alive = true;
    (async () => {
      setCentrosLoading(true);
      try {
        const centros = await obtenerCentrosCosto(); // [{id, nombre}]
        if (!alive) return;
        const options =
          (centros || [])
            .filter((c) => !!c?.nombre)
            .map((c) => ({ value: c.id, label: c.nombre })) || [];
        setCentrosOptions(options);
      } catch (e) {
        console.error("Error cargando centros de costo:", e);
        setCentrosOptions([]);
      } finally {
        if (alive) setCentrosLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loading, usuario]);

  // CÓDIGO inicial + cargar lista según rol
  useEffect(() => {
    if (loading || !usuario?.email) return;
    let alive = true;
    (async () => {
      try {
        const [reqs, cod] = await Promise.all([
          obtenerRequerimientosPorRol(usuario.email, usuario.rol),
          generarCodigoRequerimiento(),
        ]);
        if (!alive) return;
        (reqs || []).sort((a, b) => String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")));
        setRequerimientos(reqs || []);
        setForm((prev) => ({
          ...prev,
          codigo: cod || prev.codigo,
          solicitante: usuario.email,
        }));
      } catch (e) {
        console.error("Error cargando requerimientos:", e);
      }
    })();
    return () => { alive = false; };
  }, [loading, usuario?.email, usuario?.rol]);

  // Si quieres TIEMPO REAL, descomenta y quita la carga una sola vez de arriba:
  // useEffect(() => {
  //   if (loading || !usuario?.email) return;
  //   const qRef = query(
  //     collection(db, "requerimientos"),
  //     where("usuario", "==", usuario.email)
  //   );
  //   const unsubscribe = onSnapshot(qRef, (snap) => {
  //     const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  //     lista.sort((a, b) => String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")));
  //     setRequerimientos(lista);
  //   });
  //   return () => unsubscribe();
  // }, [loading, usuario?.email]);

  const requerimientosFiltrados = useMemo(() => {
    const q = (busqueda || "").toLowerCase().trim();
    return (requerimientos || []).filter((r) => {
      const texto = `${r.codigo || ""} ${r.detalle || ""}`.toLowerCase();
      const matchTexto = !q || texto.includes(q);
      const matchCentro = filtroCentro
        ? (r.centroCosto || "").toLowerCase().includes(filtroCentro.toLowerCase())
        : true;
      const matchEstado = filtroEstado === "Todos" || r.estado === filtroEstado;
      return matchTexto && matchCentro && matchEstado;
    });
  }, [requerimientos, busqueda, filtroCentro, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(requerimientosFiltrados.length / ITEMS_POR_PAGINA));
  const requerimientosPaginados = useMemo(() => {
    const start = (pagina - 1) * ITEMS_POR_PAGINA;
    return requerimientosFiltrados.slice(start, start + ITEMS_POR_PAGINA);
  }, [requerimientosFiltrados, pagina]);

  const cambiarEstado = async (rq, nuevoEstado) => {
    if (cambiandoEstado) return;
    setCambiandoEstado(rq.id);
    try {
      await actualizarEstadoRequerimiento(rq.id, nuevoEstado, usuario.email);
      setRequerimientos((prev) =>
        prev.map((r) => (r.id === rq.id ? { ...r, estado: nuevoEstado } : r))
      );
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el estado.");
    } finally {
      setCambiandoEstado(null);
    }
  };

  const puedeGestionarEstado = ["admin", "operaciones"].includes((usuario?.rol || "").toLowerCase());

  const reqExportData = requerimientosFiltrados.map((r) => ({
    codigo: r.codigo, fecha: r.fecha, centroCosto: r.centroCosto,
    detalle: r.detalle, cantItems: (r.items || []).length, estado: r.estado,
  }));
  const reqExportHeaders = {
    codigo: "Código", fecha: "Fecha", centroCosto: "Centro de Costo",
    detalle: "Detalle", cantItems: "Cantidad de Ítems", estado: "Estado",
  };

  const agregarItem = () => {
    if (!itemActual.nombre || !itemActual.unidad || Number(itemActual.cantidad) <= 0) {
      alert("Completa los datos del ítem");
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...itemActual, cantidad: Number(itemActual.cantidad) }],
    }));
    setItemActual({ nombre: "", cantidad: 1, unidad: "" });
  };

  const validarForm = () => {
    if (!form.codigo) return "Falta el código.";
    if (!form.centroCosto) return "Selecciona un centro de costo.";
    if (!form.items.length) return "Agrega al menos un ítem.";
    return null;
  };

  const guardar = async () => {
    // asegurar código incluso si el fetch de correlativo falló
    let codigo = form.codigo;
    if (!codigo) {
      try {
        codigo = await generarCodigoRequerimiento();
      } catch {
        codigo = `RQ-${Date.now()}`; // fallback
      }
      setForm((prev) => ({ ...prev, codigo })); // reflejo en UI
    }

    const v = validarForm();
    if (v) return alert(v);

    const nuevo = {
      ...form,
      codigo,
      estado: "Pendiente de Operaciones", // Cambiado para entrar al flujo de aprobación
      asignadoA: null, // Reset de asignación para que sea visible por el rol
      centroCosto: form.centroCosto,
      centroCostoId: form.centroCostoId || null,
      usuario: usuario.email, // importante para jalar por usuario
      creadoPor: usuario.email,
      creadoEn: new Date().toISOString(),
    };

    try {
      await agregarRequerimiento(nuevo);
      alert("Requerimiento guardado ✅");

      // refresco de lista + nuevo correlativo
      const [next, lista] = await Promise.all([
        generarCodigoRequerimiento().catch(() => `RQ-${Date.now()}`),
        obtenerRequerimientosPorRol(usuario.email, usuario.rol).catch(() => []),
      ]);
      (lista || []).sort((a, b) => String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")));
      setRequerimientos(lista || []);
      setForm({
        codigo: next,
        fecha: new Date().toISOString().split("T")[0],
        solicitante: usuario.email,
        centroCosto: "",
        centroCostoId: "",
        detalle: "",
        items: [],
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el requerimiento.");
    }
  };

  // Acceso controlado por RutaProtegida en AppRoutes; aquí solo protección mínima
  if (loading) return <div className="p-6">Cargando usuario…</div>;
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  // Solo comprador puede crear nuevos requerimientos
  const puedeCrear = ["admin", "comprador"].includes((usuario?.rol || "").toLowerCase());

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Requerimientos de Compra</h2>

      {/* Card del formulario — solo para roles que pueden crear */}
      {puedeCrear && <div className="bg-white p-6 rounded shadow mb-6">
        {/* Fila: Código / Fecha / Centro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Código (solo lectura) */}
          <div>
            <label className="block text-sm font-medium mb-1">Código</label>
            <input
              type="text"
              value={form.codigo}
              readOnly
              className="border p-2 rounded w-full bg-gray-50"
              placeholder="Cargando…"
            />
          </div>

          {/* Fecha de Emisión */}
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de Emisión</label>
            <input
              type="date"
              disabled
              value={form.fecha}
              className="border p-2 rounded w-full bg-gray-50"
            />
          </div>

          {/* Centro de Costo */}
          <div>
            <label className="block text-sm font-medium mb-1">Centro de Costo</label>
            <Select
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              options={centrosOptions}
              isLoading={centrosLoading}
              isClearable
              isSearchable
              placeholder={centrosLoading ? "Cargando..." : "Selecciona / escribe para buscar..."}
              value={
                form.centroCosto
                  ? { value: form.centroCostoId, label: form.centroCosto }
                  : null
              }
              onChange={(op) =>
                setForm((prev) => ({
                  ...prev,
                  centroCosto: op?.label || "",
                  centroCostoId: op?.value || "",
                }))
              }
              noOptionsMessage={() =>
                centrosLoading ? "Cargando..." : "No hay centros de costo"
              }
            />
          </div>

          {/* Detalle */}
          <div className="md:col-span-3">
            <input
              type="text"
              placeholder="Detalle (opcional)"
              value={form.detalle}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
              className="border p-2 rounded w-full"
            />
          </div>

          {/* Ítems (tabla con encabezados) */}
          <div className="md:col-span-3">
            <p className="font-bold mb-2">Ítems del Requerimiento</p>

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
                        <input
                          type="text"
                          value={item.nombre}
                          onChange={(e) => {
                            const nuevos = [...form.items];
                            nuevos[i].nombre = e.target.value;
                            setForm({ ...form, items: nuevos });
                          }}
                          placeholder="Ej: Monitor, teclado..."
                          className="border rounded px-2 py-1 w-full"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.cantidad}
                          onChange={(e) => {
                            const nuevos = [...form.items];
                            nuevos[i].cantidad = parseInt(e.target.value || "0", 10);
                            setForm({ ...form, items: nuevos });
                          }}
                          className="border rounded px-2 py-1 w-20 text-right"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <input
                          type="text"
                          value={item.unidad}
                          onChange={(e) => {
                            const nuevos = [...form.items];
                            nuevos[i].unidad = e.target.value;
                            setForm({ ...form, items: nuevos });
                          }}
                          placeholder="UND, Caja, Paquete"
                          className="border rounded px-2 py-1 w-24 text-center"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <button
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              items: prev.items.filter((_, idx) => idx !== i),
                            }));
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Fila de agregar nuevo ítem */}
                  <tr className="border-t bg-gray-50">
                    <td className="p-2 border">
                      <input
                        type="text"
                        placeholder="Ítem"
                        value={itemActual.nombre}
                        onChange={(e) => setItemActual({ ...itemActual, nombre: e.target.value })}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    <td className="p-2 border text-center">
                      <input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        value={itemActual.cantidad}
                        onChange={(e) =>
                          setItemActual({ ...itemActual, cantidad: parseInt(e.target.value || "0", 10) })
                        }
                        className="border rounded px-2 py-1 w-20 text-right"
                      />
                    </td>
                    <td className="p-2 border text-center">
                      <input
                        type="text"
                        placeholder="Unidad"
                        value={itemActual.unidad}
                        onChange={(e) => setItemActual({ ...itemActual, unidad: e.target.value })}
                        className="border rounded px-2 py-1 w-24 text-center"
                      />
                    </td>
                    <td className="p-2 border text-center">
                      <button
                        onClick={agregarItem}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        <PlusCircle size={18} />
                      </button>
                    </td>
                  </tr>

                  {form.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-500 p-4">
                        Sin ítems. Agrega al menos uno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Guardar */}
          <div className="md:col-span-3 flex justify-end">
            <button
              onClick={guardar}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Buscar por código o detalle..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          className="border p-2 rounded w-full md:w-60 text-sm"
        />

        <input
          type="text"
          placeholder="Centro de Costo..."
          value={filtroCentro}
          onChange={(e) => { setFiltroCentro(e.target.value); setPagina(1); }}
          className="border p-2 rounded w-full md:w-44 text-sm"
          list="centrosCostoList"
        />
        <datalist id="centrosCostoList">
          {centrosOptions.map((o) => (
            <option key={o.value} value={o.label} />
          ))}
        </datalist>

        <select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
          className="border p-2 rounded text-sm"
        >
          <option value="Todos">Todos los estados</option>
          <option value="Pendiente de Operaciones">Pendiente de Operaciones</option>
          <option value="En Proceso">En Proceso</option>
          <option value="Completado">Completado</option>
          <option value="Rechazado">Rechazado</option>
          <option value="Cancelado">Cancelado</option>
        </select>

        <div className="ml-auto">
          <ExportMenu
            data={reqExportData}
            nombre={`requerimientos-${new Date().toISOString().slice(0,10)}`}
            titulo="Requerimientos"
            headers={reqExportHeaders}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Requerimientos Registrados</h3>
        <span className="text-xs text-gray-500">{requerimientosFiltrados.length} resultado{requerimientosFiltrados.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Centro</th>
              <th className="p-2 text-left">Detalle</th>
              <th className="p-2 text-center">Ítems</th>
              <th className="p-2 text-center">Estado</th>
              {puedeGestionarEstado && <th className="p-2 text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {requerimientosPaginados.map((r, i) => (
              <tr key={r.id || i} className="border-t hover:bg-gray-50">
                <td className="p-2 font-mono text-xs">{r.codigo}</td>
                <td className="p-2 text-xs">{r.fecha}</td>
                <td className="p-2 text-xs">{r.centroCosto}</td>
                <td className="p-2 max-w-[200px] truncate" title={r.detalle}>{r.detalle || "—"}</td>
                <td className="p-2 text-center">{(r.items || []).length}</td>
                <td className="p-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.estado] || "bg-gray-100 text-gray-600"}`}>
                    {r.estado || "Sin estado"}
                  </span>
                </td>
                {puedeGestionarEstado && (
                  <td className="p-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {r.estado === "Pendiente de Operaciones" && (
                        <button
                          onClick={() => cambiarEstado(r, "En Proceso")}
                          disabled={cambiandoEstado === r.id}
                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          En Proceso
                        </button>
                      )}
                      {(r.estado === "Pendiente de Operaciones" || r.estado === "En Proceso") && (
                        <>
                          <button
                            onClick={() => cambiarEstado(r, "Completado")}
                            disabled={cambiandoEstado === r.id}
                            className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Completado
                          </button>
                          <button
                            onClick={() => cambiarEstado(r, "Rechazado")}
                            disabled={cambiandoEstado === r.id}
                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {!["Completado","Cancelado"].includes(r.estado) && (
                        <button
                          onClick={() => cambiarEstado(r, "Cancelado")}
                          disabled={cambiandoEstado === r.id}
                          className="text-xs px-2 py-1 rounded bg-gray-400 text-white hover:bg-gray-500 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {requerimientosPaginados.length === 0 && (
              <tr>
                <td colSpan={puedeGestionarEstado ? 7 : 6} className="text-center text-gray-500 p-4">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina === 1}
            className="px-3 py-1 rounded border text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          {[...Array(totalPaginas)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPagina(i + 1)}
              className={`px-3 py-1 rounded border text-sm ${pagina === i + 1 ? "bg-[#004990] text-white" : "hover:bg-gray-100"}`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas}
            className="px-3 py-1 rounded border text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default Requerimientos;
