import React, { useEffect, useState } from "react";
import {
  obtenerCotizaciones,
  agregarCotizacion,
} from "../firebase/cotizacionesHelpers";
import { obtenerProveedores } from "../firebase/proveedoresHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { PlusCircle } from "lucide-react";
import Select from "react-select";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useUsuario } from "../context/UsuarioContext";


const Cotizaciones = () => {
  const { usuario, loading } = useUsuario();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [archivoCotizacion, setArchivoCotizacion] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");

  const [form, setForm] = useState({
    codigo: "",
    fecha: new Date().toISOString().split("T")[0],
    proveedorId: "",
    detalle: "",
    items: [],
  });

  const [itemActual, setItemActual] = useState({
    nombre: "",
    cantidad: 1,
    precioUnitario: 0,
  });

  useEffect(() => {
    if (!loading && usuario) {
      cargarCotizaciones();
      cargarProveedores();
    }
  }, [usuario, loading]);

  const cargarCotizaciones = async () => {
    const lista = await obtenerCotizaciones();
    setCotizaciones(lista);
  };

  const cargarProveedores = async () => {
    const lista = await obtenerProveedores();
    setProveedores(lista);
  };

  const agregarItem = () => {
    if (!itemActual.nombre || itemActual.precioUnitario <= 0) {
      alert("Completa los datos del ítem");
      return;
    }
    setForm({ ...form, items: [...form.items, itemActual] });
    setItemActual({ nombre: "", cantidad: 1, precioUnitario: 0 });
  };

  const guardar = async () => {
    if (!form.codigo || !form.proveedorId || form.items.length === 0) {
      alert("Completa todos los campos y agrega ítems.");
      return;
    }

    const cotizacion = { ...form };

    if (archivoCotizacion) {
      const urlTemporal = URL.createObjectURL(archivoCotizacion);
      cotizacion.archivoUrl = urlTemporal;
    }

    await agregarCotizacion(cotizacion);
    alert("Cotización guardada ✅");

    setForm({
      codigo: "",
      fecha: new Date().toISOString().split("T")[0],
      proveedorId: "",
      detalle: "",
      items: [],
    });
    setArchivoCotizacion(null);
    cargarCotizaciones();
  };

  const cotizacionesFiltradas = cotizaciones.filter((cot) => {
    const matchBusqueda =
      cot.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      cot.detalle.toLowerCase().includes(busqueda.toLowerCase());
    const matchProveedor = filtroProveedor ? cot.proveedorId === filtroProveedor : true;
    return matchBusqueda && matchProveedor;
  });

  const exportarExcel = () => {
    if (!cotizacionesFiltradas.length) {
      alert("No hay datos para exportar");
      return;
    }

    const data = cotizacionesFiltradas.map((cot) => {
      const proveedor = proveedores.find((p) => p.id === cot.proveedorId);
      return {
        Código: cot.codigo,
        Fecha: cot.fecha,
        Proveedor: proveedor?.razonSocial || "—",
        Detalle: cot.detalle,
        "N° Ítems": cot.items.length,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizaciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `Cotizaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const proveedorSeleccionado = proveedores.find((p) => p.id === form.proveedorId);

  if (loading) return <div className="p-6">Cargando usuario.</div>;
  if (!usuario || !["admin", "comprador"].includes(usuario?.rol)) return <div className="p-6">Acceso no autorizado</div>;

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

        <div className="col-span-1 md:col-span-2">
          <Select
            options={proveedores.map((p) => ({
              value: p.id,
              label: `${p.ruc} - ${p.razonSocial}`,
            }))}
            value={
              proveedorSeleccionado
                ? {
                    value: proveedorSeleccionado.id,
                    label: `${proveedorSeleccionado.ruc} - ${proveedorSeleccionado.razonSocial}`,
                  }
                : null
            }
            onChange={(opcion) =>
              setForm((prev) => ({ ...prev, proveedorId: opcion?.value || "" }))
            }
            placeholder="Selecciona proveedor..."
            isClearable
            isSearchable
          />
        </div>

        <input
          type="text"
          placeholder="Detalle (opcional)"
          value={form.detalle}
          onChange={(e) => setForm({ ...form, detalle: e.target.value })}
          className="border p-2 rounded"
        />

        {/* Subir archivo */}
        <div className="col-span-1 md:col-span-2">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setArchivoCotizacion(e.target.files[0])}
            className="border p-2 rounded w-full"
          />
        </div>

        {/* Ítems */}
        <div className="col-span-1 md:col-span-2 border-t pt-4">
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
              value={itemActual.cantidad}
              onChange={(e) =>
                setItemActual({ ...itemActual, cantidad: parseInt(e.target.value) })
              }
              className="border p-2 rounded w-32"
            />
            <input
              type="number"
              placeholder="Precio Unitario"
              value={itemActual.precioUnitario}
              onChange={(e) =>
                setItemActual({
                  ...itemActual,
                  precioUnitario: parseFloat(e.target.value),
                })
              }
              className="border p-2 rounded w-48"
            />
            <button
              onClick={agregarItem}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
              title="Agregar ítem"
            >
              <PlusCircle size={18} />
            </button>
          </div>
          <ul className="text-sm list-disc ml-6">
            {form.items.map((item, i) => (
              <li key={i}>
                {item.nombre} - {item.cantidad} x{" "}
                {formatearMoneda(item.precioUnitario)}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={guardar}
          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-fit"
        >
          Guardar Cotización
        </button>
      </div>

      {/* Filtros y Exportar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="🔍 Buscar por código o detalle..."
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
            <option key={p.id} value={p.id}>
              {p.razonSocial}
            </option>
          ))}
        </select>
        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full md:w-auto"
        >
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
              <th className="p-2">Fecha</th>
              <th className="p-2">Detalle</th>
              <th className="p-2">Ítems</th>
              <th className="p-2">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {cotizacionesFiltradas.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-gray-500 p-4">
                  No hay cotizaciones registradas.
                </td>
              </tr>
            ) : (
              cotizacionesFiltradas.map((cot) => {
                const proveedor = proveedores.find((p) => p.id === cot.proveedorId);
                return (
                  <tr key={cot.id} className="text-center border-t">
                    <td className="p-2">{cot.codigo}</td>
                    <td className="p-2">{proveedor?.razonSocial || "—"}</td>
                    <td className="p-2">{cot.fecha}</td>
                    <td className="p-2">{cot.detalle}</td>
                    <td className="p-2">{cot.items?.length || 0}</td>
                    <td className="p-2">
                      {cot.archivoUrl ? (
                        <a
                          href={cot.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Ver
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Cotizaciones;
