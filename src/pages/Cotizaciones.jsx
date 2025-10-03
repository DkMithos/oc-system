// ✅ src/pages/Cotizaciones.jsx (editable)
import React, { useEffect, useMemo, useState } from "react";
import {
  obtenerCotizaciones,
  agregarCotizacion,
  actualizarCotizacion,
  eliminarCotizacion,
} from "../firebase/cotizacionesHelpers";
import { obtenerProveedores } from "../firebase/proveedoresHelpers";
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
import EditCotizacionModal from "../components/EditCotizacionModal";

const UNIDADES = [
  "UND","CJ","PAQ","PAR","JGO","PZA","KIT",
  "KG","g","TON",
  "LT","ML","GLN",
  "M","MT2","MT3","ROLLO",
  "SERV","HRS","DIA","MES","AÑO"
];

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

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
    moneda: "Soles",
    items: [],
  });

  const [itemActual, setItemActual] = useState({
    codigo: "",
    nombre: "",
    unidad: "UND",
    cantidad: 1,
    precioUnitario: 0,
    descuento: 0,
  });

  // Modal de edición rápida
  const [editOpen, setEditOpen] = useState(false);
  const [cotEdit, setCotEdit] = useState(null);

  // ======= carga inicial =======
  useEffect(() => {
    if (!loading && usuario) {
      (async () => {
        const [listaCot, listaProv, listaRq] = await Promise.all([
          obtenerCotizaciones(),
          obtenerProveedores(),
          obtenerRequerimientosPorUsuario(usuario.email),
        ]);
        setCotizaciones(listaCot || []);
        setProveedores(listaProv || []);
        // Ordena RQ por fecha de creación (desc) si existe
        (listaRq || []).sort((a, b) => String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")));
        setRequerimientos(listaRq || []);
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
        raw: r,
      })),
    [requerimientos]
  );

  const proveedorSeleccionado = proveedores.find((p) => p.id === form.proveedorId);
  const rqSeleccionado = requerimientos.find((r) => r.id === form.requerimientoId);

  // ========== Importar ítems del RQ ==========
  const mapRqItemsToCot = (rq) => {
    const src = Array.isArray(rq?.items) ? rq.items : [];
    return src.map((it) => ({
      codigo: "",
      nombre: it.nombre || "",
      unidad: it.unidad || "UND",
      cantidad: Number(it.cantidad || 0),
      precioUnitario: 0,
      descuento: 0,
    }));
  };

  const importarItemsDesdeRQ = (rq) => {
    if (!rq) return;
    const mapped = mapRqItemsToCot(rq);
    if (!mapped.length) {
      alert("El requerimiento seleccionado no tiene ítems.");
      return;
    }
    setForm((prev) => ({ ...prev, items: mapped }));
  };

  const onSeleccionarRQ = (op) => {
    if (!op) {
      setForm((prev) => ({ ...prev, requerimientoId: "" }));
      return;
    }
    const rq = op.raw;
    if (!form.items.length) importarItemsDesdeRQ(rq);
    else if (confirm("¿Reemplazar los ítems actuales por los del requerimiento?")) {
      importarItemsDesdeRQ(rq);
    }
    setForm((prev) => ({ ...prev, requerimientoId: op.value }));
  };

  // ======= ítems (alta rápida + edición en línea) =======
  const agregarItem = () => {
    if (!itemActual.nombre) {
      alert("Ingresa al menos la descripción del ítem.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          codigo: itemActual.codigo || "",
          nombre: itemActual.nombre || "",
          unidad: itemActual.unidad || "UND",
          cantidad: num(itemActual.cantidad),
          precioUnitario: num(itemActual.precioUnitario),
          descuento: num(itemActual.descuento),
        },
      ],
    }));
    setItemActual({
      codigo: "",
      nombre: "",
      unidad: "UND",
      cantidad: 1,
      precioUnitario: 0,
      descuento: 0,
    });
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      let v = value;
      if (["cantidad", "precioUnitario", "descuento"].includes(field)) {
        v = num(value);
      }
      items[idx] = { ...items[idx], [field]: v };
      return { ...prev, items };
    });
  };

  const removeItem = (idx) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  // Totales (consistentes con CrearOC.jsx)
  const totalCot = (cot) =>
    (cot.items || []).reduce(
      (acc, it) => acc + num(it.cantidad) * num(it.precioUnitario) - num(it.descuento),
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
        Moneda: cot.moneda || "Soles",
        Proveedor: proveedor?.razonSocial || "—",
        Detalle: cot.detalle || "",
        "N° Ítems": cot.items?.length || 0,
        Total: formatearMoneda(totalCot(cot), cot.moneda || "Soles"),
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
        requerimientoId: form.requerimientoId,
        detalle: form.detalle || "",
        moneda: form.moneda || "Soles",
        items: form.items.map((i) => ({
          codigo: i.codigo || "",
          nombre: i.nombre,
          unidad: i.unidad || "UND",
          cantidad: num(i.cantidad),
          precioUnitario: num(i.precioUnitario),
          descuento: num(i.descuento),
        })),
        archivoUrl: "",
        estado: "Pendiente de Operaciones",
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
        moneda: "Soles",
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
    navigate("/crear", { state: { desdeCotizacion: { cotizacionId: cot.id } } });
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

        {/* Requerimiento (importa ítems) */}
        <div className="md:col-span-2">
          <Select
            options={rqOptions}
            value={
              rqSeleccionado
                ? { value: rqSeleccionado.id, label: `${rqSeleccionado.codigo} — ${rqSeleccionado.centroCosto || ""}` }
                : null
            }
            onChange={onSeleccionarRQ}
            placeholder="Selecciona requerimiento (importa ítems)..."
            isClearable isSearchable
          />
          {rqSeleccionado && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => importarItemsDesdeRQ(rqSeleccionado)}
                className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
                title="Reemplaza los ítems actuales por los del RQ seleccionado"
              >
                Importar ítems del requerimiento
              </button>
            </div>
          )}
        </div>

        {/* Moneda */}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600 mb-1 block">Moneda</label>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="moneda"
                checked={form.moneda === "Soles"}
                onChange={() => setForm((f) => ({ ...f, moneda: "Soles" }))}
              />
              <span>Soles</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="moneda"
                checked={form.moneda === "Dólares"}
                onChange={() => setForm((f) => ({ ...f, moneda: "Dólares" }))}
              />
              <span>Dólares</span>
            </label>
          </div>
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
          <p className="text-xs text-gray-500 mt-1">
            (Sube PDF/Word/Excel o imagen; idealmente archivos no escaneados)
          </p>
        </div>

        {/* Ítems (alta rápida) */}
        <div className="md:col-span-2 border-t pt-4">
          <p className="font-bold mb-2">Ítems de la Cotización</p>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-2">
            <input
              type="text"
              placeholder="Código"
              value={itemActual.codigo}
              onChange={(e) => setItemActual({ ...itemActual, codigo: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Ítem / Descripción"
              value={itemActual.nombre}
              onChange={(e) => setItemActual({ ...itemActual, nombre: e.target.value })}
              className="border p-2 rounded md:col-span-2"
            />
            <select
              value={itemActual.unidad}
              onChange={(e) => setItemActual({ ...itemActual, unidad: e.target.value })}
              className="border p-2 rounded"
              title="Unidad de medida"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Cantidad"
              min={0}
              value={itemActual.cantidad}
              onChange={(e) => setItemActual({ ...itemActual, cantidad: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="number"
              placeholder="P. Unitario"
              step="0.01"
              value={itemActual.precioUnitario}
              onChange={(e) => setItemActual({ ...itemActual, precioUnitario: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="number"
              placeholder="Dscto (monto)"
              step="0.01"
              value={itemActual.descuento}
              onChange={(e) => setItemActual({ ...itemActual, descuento: e.target.value })}
              className="border p-2 rounded"
            />
          </div>
          <button
            onClick={agregarItem}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center gap-2"
            title="Agregar ítem"
            type="button"
          >
            <PlusCircle size={18} /> Agregar ítem
          </button>

          {/* Tabla editable */}
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border">Código</th>
                  <th className="p-2 border text-left">Descripción</th>
                  <th className="p-2 border">U.M.</th>
                  <th className="p-2 border text-right">Cant.</th>
                  <th className="p-2 border text-right">P. Unit.</th>
                  <th className="p-2 border text-right">Dscto</th>
                  <th className="p-2 border text-right">Total</th>
                  <th className="p-2 border text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {(form.items || []).map((it, i) => {
                  const total = num(it.cantidad) * num(it.precioUnitario) - num(it.descuento);
                  return (
                    <tr key={i}>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={it.codigo || ""}
                          onChange={(e) => updateItem(i, "codigo", e.target.value)}
                          className="border rounded px-2 py-1 w-full"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={it.nombre}
                          onChange={(e) => updateItem(i, "nombre", e.target.value)}
                          className="border rounded px-2 py-1 w-full"
                        />
                      </td>
                      <td className="p-2 border">
                        <select
                          value={it.unidad || "UND"}
                          onChange={(e) => updateItem(i, "unidad", e.target.value)}
                          className="border rounded px-2 py-1 w-full"
                          title="Unidad de medida"
                        >
                          {UNIDADES.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border text-right">
                        <input
                          type="number"
                          min={0}
                          value={it.cantidad}
                          onChange={(e) => updateItem(i, "cantidad", e.target.value)}
                          className="border rounded px-2 py-1 w-24 text-right"
                        />
                      </td>
                      <td className="p-2 border text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={it.precioUnitario}
                          onChange={(e) => updateItem(i, "precioUnitario", e.target.value)}
                          className="border rounded px-2 py-1 w-28 text-right"
                        />
                      </td>
                      <td className="p-2 border text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={it.descuento || 0}
                          onChange={(e) => updateItem(i, "descuento", e.target.value)}
                          className="border rounded px-2 py-1 w-28 text-right"
                        />
                      </td>
                      <td className="p-2 border text-right">
                        {formatearMoneda(total, form.moneda)}
                      </td>
                      <td className="p-2 border text-center">
                        <button
                          onClick={() => removeItem(i)}
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                          title="Eliminar"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(form.items || []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-500 p-3">
                      Sin ítems.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <button
          onClick={guardar}
          disabled={guardando}
          className="text-sm bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 w-fit disabled:opacity-60 md:col-span-2"
          type="button"
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

      {/* Tabla general */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Proveedor</th>
              <th className="p-2">Requerimiento</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Moneda</th>
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
                <td colSpan="10" className="text-center text-gray-500 p-4">
                  No hay cotizaciones registradas.
                </td>
              </tr>
            ) : (
              cotizacionesFiltradas.map((cot) => {
                const proveedor = proveedores.find((p) => p.id === cot.proveedorId);
                const rq = requerimientos.find((r) => r.id === cot.requerimientoId);
                const total = formatearMoneda(totalCot(cot), cot.moneda || "Soles");
                return (
                  <tr key={cot.id} className="text-center border-t">
                    <td className="p-2">{cot.codigo}</td>
                    <td className="p-2">{proveedor?.razonSocial || "—"}</td>
                    <td className="p-2">{rq?.codigo || "—"}</td>
                    <td className="p-2">{cot.fecha}</td>
                    <td className="p-2">{cot.moneda || "Soles"}</td>
                    <td className="p-2">{cot.detalle}</td>
                    <td className="p-2">{cot.items?.length || 0}</td>
                    <td className="p-2">{total}</td>
                    <td className="p-2">
                      {cot.archivoUrl ? (
                        <a
                          href={cot.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 justify-center"
                        >
                          <ExternalLink size={16} /> Ver
                        </a>
                      ) : "—"}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => editar(cot)}
                          className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => generarOrden(cot)}
                          className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Generar orden
                        </button>
                        <button
                          onClick={() => borrar(cot)}
                          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
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
