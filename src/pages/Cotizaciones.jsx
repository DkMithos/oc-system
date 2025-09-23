// ✅ src/pages/Cotizaciones.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  obtenerCotizaciones,
  agregarCotizacion,
  actualizarCotizacion,
  eliminarCotizacion,
} from "../firebase/cotizacionesHelpers";
import { obtenerProveedores } from "../firebase/proveedoresHelpers"; // usa este único helper de proveedores
import { formatearMoneda } from "../utils/formatearMoneda";
import { PlusCircle, Trash2, ExternalLink } from "lucide-react";
import Select from "react-select";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useUsuario } from "../context/UsuarioContext";
import { storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { obtenerRequerimientosPorUsuario } from "../firebase/requerimientosHelpers";
import { useNavigate } from "react-router-dom";
import EditCotizacionModal from "../components/EditCotizacionModal"; // si no lo usarás, elimina este import y el botón "Editar"

const Cotizaciones = () => {
  const navigate = useNavigate();
  const { usuario, loading } = useUsuario();

  const [cotizaciones, setCotizaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [requerimientos, setRequerimientos] = useState([]);

  const [archivoCotizacion, setArchivoCotizacion] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");

  const [form, setForm] = useState({
    codigo: "",
    fecha: new Date().toISOString().split("T")[0],
    proveedorId: "",
    requerimientoId: "",
    detalle: "",
    items: [],
  });

  const [itemActual, setItemActual] = useState({
    nombre: "",
    cantidad: 1,
    precioUnitario: 0,
  });

  // Modal de edición rápida
  const [editOpen, setEditOpen] = useState(false);
  const [cotEdit, setCotEdit] = useState(null);

  // ======= carga inicial =======
  useEffect(() => {
    if (!loading && usuario) {
      (async () => {
        const [listaCot, listaProv] = await Promise.all([
          obtenerCotizaciones(),
          obtenerProveedores(),
        ]);
        setCotizaciones(listaCot || []);
        setProveedores(listaProv || []);

        // requerimientos del usuario (si luego quieres admin=all, agrega un helper obtenerRequerimientosAll)
        const rqs = await obtenerRequerimientosPorUsuario(usuario.email);
        setRequerimientos(rqs || []);
      })();
    }
  }, [usuario, loading]);

  // ======= helpers =======
  const proveedorOptions = useMemo(
    () =>
      (proveedores || []).map((p) => ({
        value: p.id,
        label: `${p.ruc} - ${p.razonSocial}`,
      })),
    [proveedores]
  );

  const rqOptions = useMemo(
    () =>
      (requerimientos || []).map((r) => ({
        value: r.id,
        label: `${r.codigo} — ${r.centroCosto || ""}`,
      })),
    [requerimientos]
  );

  const proveedorSeleccionado = proveedores.find((p) => p.id === form.proveedorId);
  const rqSeleccionado = requerimientos.find((r) => r.id === form.requerimientoId);

  const agregarItem = () => {
    if (!itemActual.nombre || Number(itemActual.precioUnitario) <= 0) {
      alert("Completa nombre y precio del ítem");
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...itemActual,
          cantidad: Number(itemActual.cantidad || 0),
        },
      ],
    }));
    setItemActual({ nombre: "", cantidad: 1, precioUnitario: 0 });
  };

  const totalCot = (cot) =>
    (cot.items || []).reduce(
      (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precioUnitario || 0),
      0
    );

  const cotizacionesFiltradas = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    return (cotizaciones || []).filter((cot) => {
      const texto = `${cot.codigo || ""} ${cot.detalle || ""}`.toLowerCase();
      const matchBusqueda = !query || texto.includes(query);
      const matchProveedor = filtroProveedor ? cot.proveedorId === filtroProveedor : true;
      return matchBusqueda && matchProveedor;
    });
  }, [cotizaciones, busqueda, filtroProveedor]);

  const exportarExcel = () => {
    if (!cotizacionesFiltradas.length) return alert("No hay datos para exportar");
    const data = cotizacionesFiltradas.map((cot) => {
      const proveedor = proveedores.find((p) => p.id === cot.proveedorId);
      return {
        Código: cot.codigo,
        Fecha: cot.fecha,
        Proveedor: proveedor?.razonSocial || "—",
        Detalle: cot.detalle || "",
        "N° Ítems": cot.items?.length || 0,
        Total: formatearMoneda(totalCot(cot)),
        "Tiene Archivo": cot.archivoUrl ? "Sí" : "No",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizaciones");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Cotizaciones_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // ======= guardar =======
  const guardar = async () => {
    if (!form.codigo || !form.proveedorId || !form.requerimientoId || form.items.length === 0) {
      alert("Completa código, proveedor, requerimiento y agrega ítems.");
      return;
    }
    // código único
    const yaExiste = cotizaciones.some(
      (c) => String(c.codigo || "").trim().toLowerCase() === form.codigo.trim().toLowerCase()
    );
    if (yaExiste) {
      alert("Ya existe una cotización con ese código.");
      return;
    }

    setGuardando(true);
    try {
      const base = {
        codigo: form.codigo.trim(),
        fecha: form.fecha,
        proveedorId: form.proveedorId,
        requerimientoId: form.requerimientoId, // enlace a RQ
        detalle: form.detalle || "",
        items: form.items.map((i) => ({
          nombre: i.nombre,
          cantidad: Number(i.cantidad || 0),
          precioUnitario: Number(i.precioUnitario || 0),
        })),
        archivoUrl: "",
        estado: "Pendiente de Operaciones", // opcional: arranca el flujo de aprobación
        creadoPor: usuario?.email || "",
        creadoEn: new Date().toISOString(),
      };

      const newId = await agregarCotizacion(base);

      if (archivoCotizacion) {
        const ext = (archivoCotizacion.name.split(".").pop() || "").toLowerCase();
        const safe = (form.codigo || newId).replace(/[^\w\-]+/g, "_") + "." + ext;
        const storageRef = ref(storage, `cotizaciones/${newId}/${safe}`);
        await uploadBytes(storageRef, archivoCotizacion);
        const url = await getDownloadURL(storageRef);
        await actualizarCotizacion(newId, { archivoUrl: url });
      }

      alert("Cotización guardada ✅");
      // reset
      setForm({
        codigo: "",
        fecha: new Date().toISOString().split("T")[0],
        proveedorId: "",
        requerimientoId: "",
        detalle: "",
        items: [],
      });
      setArchivoCotizacion(null);

      const lista = await obtenerCotizaciones();
      setCotizaciones(lista || []);
    } catch (e) {
      console.error("Error guardando cotización:", e);
      alert("Ocurrió un error al guardar la cotización.");
    } finally {
      setGuardando(false);
    }
  };

  // ======= acciones fila =======
  const generarOrden = (cot) => {
    // navega a CrearOC con la cotización preseleccionada
    navigate("/crear", {
      state: { desdeCotizacion: { cotizacionId: cot.id } },
    });
  };

  const borrar = async (cot) => {
    if (!confirm(`¿Eliminar la cotización ${cot.codigo}?`)) return;
    try {
      await eliminarCotizacion(cot.id);
      setCotizaciones((prev) => prev.filter((x) => x.id !== cot.id));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  };

  const editar = (cot) => {
    setCotEdit(cot);
    setEditOpen(true);
  };

  const afterEditSaved = async () => {
    const lista = await obtenerCotizaciones();
    setCotizaciones(lista || []);
  };

  // ======= render =======
  if (loading) return <div className="p-6">Cargando usuario…</div>;
  if (!usuario || !["admin", "comprador"].includes(usuario?.rol))
    return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Registro de Cotizaciones</h2>

      {/* Formulario */}
      <div className="bg-white p-6 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Código (ej: COT-001)"
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          className="border p-2 rounded"
        />

        {/* Proveedor */}
        <div className="md:col-span-2">
          <Select
            options={proveedorOptions}
            value={
              proveedorSeleccionado
                ? { value: proveedorSeleccionado.id, label: `${proveedorSeleccionado.ruc} - ${proveedorSeleccionado.razonSocial}` }
                : null
            }
            onChange={(op) => setForm((prev) => ({ ...prev, proveedorId: op?.value || "" }))}
            placeholder="Selecciona proveedor..."
            isClearable isSearchable
          />
        </div>

        {/* Requerimiento */}
        <div className="md:col-span-2">
          <Select
            options={rqOptions}
            value={
              rqSeleccionado ? { value: rqSeleccionado.id, label: `${rqSeleccionado.codigo} — ${rqSeleccionado.centroCosto || ""}` } : null
            }
            onChange={(op) => setForm((prev) => ({ ...prev, requerimientoId: op?.value || "" }))}
            placeholder="Selecciona requerimiento..."
            isClearable isSearchable
          />
        </div>

        <input
          type="text"
          placeholder="Detalle (opcional)"
          value={form.detalle}
          onChange={(e) => setForm({ ...form, detalle: e.target.value })}
          className="border p-2 rounded md:col-span-2"
        />

        {/* Archivo */}
        <div className="md:col-span-2">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => setArchivoCotizacion(e.target.files?.[0] || null)}
            className="border p-2 rounded w-full"
          />
          <p className="text-xs text-gray-500 mt-1">(Sube PDF/Word/Excel o imagen; idealmente archivos no escaneados)</p>
        </div>

        {/* Ítems */}
        <div className="md:col-span-2 border-t pt-4">
          <p className="font-bold mb-2">Agregar ítems:</p>
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <input
              type="text"
              placeholder="Ítem"
              value={itemActual.nombre}
              onChange={(e) => setItemActual({ ...itemActual, nombre: e.target.value })}
              className="border p-2 rounded flex-1"
            />
            <input
              type="number"
              placeholder="Cantidad"
              min={1}
              value={itemActual.cantidad}
              onChange={(e) => setItemActual({ ...itemActual, cantidad: parseInt(e.target.value || "0", 10) })}
              className="border p-2 rounded w-32"
            />
            <input
              type="number"
              placeholder="Precio Unitario"
              step="0.01"
              value={itemActual.precioUnitario}
              onChange={(e) => setItemActual({ ...itemActual, precioUnitario: parseFloat(e.target.value || "0") })}
              className="border p-2 rounded w-48"
            />
            <button onClick={agregarItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded" title="Agregar ítem">
              <PlusCircle size={18} />
            </button>
          </div>
          <ul className="text-sm list-disc ml-6">
            {form.items.map((it, i) => (
              <li key={i}>
                {it.nombre} — {it.cantidad} x {formatearMoneda(it.precioUnitario)}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={guardar}
          disabled={guardando}
          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-fit disabled:opacity-60"
        >
          {guardando ? "Guardando..." : "Guardar Cotización"}
        </button>
      </div>

      {/* Filtros + Export */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por código o detalle..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded w-full md:w-1/2"
        />
        <select
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
          className="border p-2 rounded w-full md:w-1/3"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.razonSocial}</option>
          ))}
        </select>
        <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full md:w-auto">
          Exportar
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Proveedor</th>
              <th className="p-2">Requerimiento</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Detalle</th>
              <th className="p-2">Ítems</th>
              <th className="p-2">Total</th>
              <th className="p-2">Archivo</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cotizacionesFiltradas.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-gray-500 p-4">No hay cotizaciones registradas.</td>
              </tr>
            ) : (
              cotizacionesFiltradas.map((cot) => {
                const proveedor = proveedores.find((p) => p.id === cot.proveedorId);
                const rq = requerimientos.find((r) => r.id === cot.requerimientoId);
                const total = formatearMoneda(totalCot(cot));
                return (
                  <tr key={cot.id} className="text-center border-t">
                    <td className="p-2">{cot.codigo}</td>
                    <td className="p-2">{proveedor?.razonSocial || "—"}</td>
                    <td className="p-2">{rq?.codigo || "—"}</td>
                    <td className="p-2">{cot.fecha}</td>
                    <td className="p-2">{cot.detalle}</td>
                    <td className="p-2">{cot.items?.length || 0}</td>
                    <td className="p-2">{total}</td>
                    <td className="p-2">
                      {cot.archivoUrl ? (
                        <a href={cot.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 justify-center">
                          <ExternalLink size={16}/> Ver
                        </a>
                      ) : "—"}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => editar(cot)}
                          className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                          title="Editar cotización"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => generarOrden(cot)}
                          className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                          title="Generar orden"
                        >
                          Generar orden
                        </button>
                        <button
                          onClick={() => borrar(cot)}
                          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                          title="Eliminar"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal edición rápida */}
      {editOpen && cotEdit && (
        <EditCotizacionModal
          cotizacion={cotEdit}
          onClose={() => { setEditOpen(false); setCotEdit(null); }}
          onSaved={afterEditSaved}
          proveedores={proveedores}
        />
      )}
    </div>
  );
};

export default Cotizaciones;
