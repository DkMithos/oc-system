// ✅ src/pages/Requerimientos.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  agregarRequerimiento,
  obtenerRequerimientosPorUsuario,
  generarCodigoRequerimiento,
} from "../firebase/requerimientosHelpers";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import { PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useUsuario } from "../context/UsuarioContext";
import Select from "react-select";

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

const Requerimientos = () => {
  const { usuario, loading } = useUsuario();

  const [busqueda, setBusqueda] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");

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
    items: [],
  });

  const [itemActual, setItemActual] = useState({
    nombre: "",
    cantidad: 1,
    unidad: "",
  });

  // CARGA DE CENTROS (independiente de requerimientos)
  useEffect(() => {
    if (loading) return;
    if (!usuario) return;

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
        setCentrosOptions([]); // no bloqueamos la pantalla
      } finally {
        if (alive) setCentrosLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loading, usuario]);

  // CARGA DE REQS + CÓDIGO (separado para no tumbar centros si falla)
  useEffect(() => {
    if (loading) return;
    if (!usuario?.email) return;

    let alive = true;
    (async () => {
      try {
        const [reqs, cod] = await Promise.all([
          obtenerRequerimientosPorUsuario(usuario.email),
          generarCodigoRequerimiento(),
        ]);
        if (!alive) return;

        setRequerimientos(reqs || []);
        setForm((prev) => ({
          ...prev,
          codigo: cod,
          solicitante: usuario.email,
        }));
      } catch (e) {
        console.error("Error cargando requerimientos/código:", e);
        // aun si falla, no afecta centros; dejamos lo que haya
      }
    })();

    return () => {
      alive = false;
    };
  }, [loading, usuario?.email]);

  const requerimientosFiltrados = useMemo(() => {
    const q = (busqueda || "").toLowerCase().trim();
    return (requerimientos || []).filter((r) => {
      const texto = `${r.codigo || ""} ${r.detalle || ""}`.toLowerCase();
      const matchTexto = !q || texto.includes(q);
      const matchCentro = filtroCentro
        ? (r.centroCosto || "").toLowerCase().includes(filtroCentro.toLowerCase())
        : true;
      return matchTexto && matchCentro;
    });
  }, [requerimientos, busqueda, filtroCentro]);

  const exportarExcel = () => {
    if (!requerimientosFiltrados.length) {
      alert("No hay datos para exportar");
      return;
    }
    const data = requerimientosFiltrados.map((r) => ({
      Código: r.codigo,
      Fecha: r.fecha,
      "Centro de Costo": r.centroCosto,
      Detalle: r.detalle,
      "Cantidad de Ítems": (r.items || []).length,
      Estado: r.estado,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requerimientos");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Requerimientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const agregarItem = () => {
    if (!itemActual.nombre || !itemActual.unidad || Number(itemActual.cantidad) <= 0) {
      alert("Completa los datos del ítem");
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { ...itemActual, cantidad: Number(itemActual.cantidad) },
      ],
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
    const v = validarForm();
    if (v) return alert(v);

    const nuevo = {
      ...form,
      estado: "Pendiente",
      centroCosto: form.centroCosto,        // compat
      centroCostoId: form.centroCostoId || null,
    };

    try {
      await agregarRequerimiento(nuevo);
      alert("Requerimiento guardado ✅");

      const [cod, lista] = await Promise.all([
        generarCodigoRequerimiento(),
        usuario?.email ? obtenerRequerimientosPorUsuario(usuario.email) : [],
      ]);

      setRequerimientos(lista || []);
      setForm({
        codigo: cod,
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

  if (loading) return <div className="p-6">Cargando usuario…</div>;
  if (!usuario || !["admin", "comprador"].includes(usuario?.rol))
    return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Requerimientos de Compra</h2>

      {/* Formulario (tarjeta) */}
      <div className="bg-white p-6 rounded shadow mb-6">
        {/* Fecha de Emisión y Centro de Costo alineados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fecha de Emisión */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Fecha de Emisión
            </label>
            <input
              type="date"
              disabled
              value={form.fecha}
              className="border p-2 rounded w-full bg-gray-50"
            />
          </div>

          {/* Centro de Costo */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Centro de Costo
            </label>
            <Select
              styles={selectStyles}
              menuPortalTarget={
                typeof document !== "undefined" ? document.body : null
              }
              options={centrosOptions}
              isLoading={centrosLoading}
              isClearable
              isSearchable
              placeholder={
                centrosLoading
                  ? "Cargando..."
                  : "Selecciona / escribe para buscar..."
              }
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

          {/* Detalle (a lo ancho) */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Detalle (opcional)"
              value={form.detalle}
              onChange={(e) =>
                setForm({ ...form, detalle: e.target.value })
              }
              className="border p-2 rounded w-full"
            />
          </div>

          {/* Ítems */}
          <div className="md:col-span-2">
            <p className="font-bold mb-2">Agregar ítems</p>
            <div className="flex flex-col md:flex-row gap-2 mb-2">
              <input
                type="text"
                placeholder="Ítem"
                value={itemActual.nombre}
                onChange={(e) =>
                  setItemActual({ ...itemActual, nombre: e.target.value })
                }
                className="border p-2 rounded flex-1"
              />
              <input
                type="number"
                placeholder="Cantidad"
                min={1}
                value={itemActual.cantidad}
                onChange={(e) =>
                  setItemActual({
                    ...itemActual,
                    cantidad: parseInt(e.target.value || "0", 10),
                  })
                }
                className="border p-2 rounded w-32"
              />
              <input
                type="text"
                placeholder="Unidad"
                value={itemActual.unidad}
                onChange={(e) =>
                  setItemActual({ ...itemActual, unidad: e.target.value })
                }
                className="border p-2 rounded w-32"
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
                  {item.nombre} - {item.cantidad} {item.unidad}
                </li>
              ))}
            </ul>
          </div>

          {/* Botón guardar alineado a la derecha */}
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={guardar}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por código o detalle..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded w-full md:w-1/3"
        />

        <input
          type="text"
          placeholder="Filtrar por Centro de Costo..."
          value={filtroCentro}
          onChange={(e) => setFiltroCentro(e.target.value)}
          className="border p-2 rounded w-full md:w-1/4"
          list="centrosCostoList"
        />
        <datalist id="centrosCostoList">
          {centrosOptions.map((o) => (
            <option key={o.value} value={o.label} />
          ))}
        </datalist>

        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full md:w-auto"
        >
          Exportar a Excel
        </button>
      </div>

      {/* Tabla */}
      <h3 className="text-lg font-semibold mb-2">Requerimientos Registrados</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Centro</th>
              <th className="p-2">Detalle</th>
              <th className="p-2">Ítems</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {requerimientosFiltrados.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.codigo}</td>
                <td className="p-2">{r.fecha}</td>
                <td className="p-2">{r.centroCosto}</td>
                <td className="p-2">{r.detalle}</td>
                <td className="p-2">{(r.items || []).length}</td>
                <td className="p-2">{r.estado}</td>
              </tr>
            ))}
            {requerimientosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 p-4">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Requerimientos;
