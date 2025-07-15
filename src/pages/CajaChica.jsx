// ✅ src/pages/CajaChica.jsx
import React, { useEffect, useState } from "react";
import {
  obtenerMovimientosCaja,
  agregarMovimientoCaja,
  subirComprobanteCaja,
} from "../firebase/cajaChicaHelpers";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import { Upload, Search } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";

const CajaChica = () => {
  const [centros, setCentros] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState({ ingresos: 0, egresos: 0 });
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const [form, setForm] = useState({
    tipo: "egreso",
    monto: "",
    descripcion: "",
    centroCosto: "",
    fecha: new Date().toISOString().split("T")[0],
    archivo: null,
  });

  useEffect(() => {
    const cargar = async () => {
      const lista = await obtenerMovimientosCaja();
      const centros = await obtenerCentrosCosto();
      setMovimientos(lista);
      setCentros(centros.map((c) => c.nombre));
      calcularResumen(lista);
    };
    cargar();
  }, []);

  const calcularResumen = (data) => {
    const ingresos = data
      .filter((m) => m.tipo === "ingreso")
      .reduce((acc, m) => acc + Number(m.monto), 0);
    const egresos = data
      .filter((m) => m.tipo === "egreso")
      .reduce((acc, m) => acc + Number(m.monto), 0);
    setResumen({ ingresos, egresos });
  };

  const handleGuardar = async () => {
    if (!form.monto || !form.centroCosto || !form.descripcion) {
      alert("Completa todos los campos obligatorios.");
      return;
    }

    const movimiento = {
      ...form,
      monto: parseFloat(form.monto),
      usuario: localStorage.getItem("userEmail"),
    };

    setLoading(true);
    try {
      if (form.archivo) {
        const url = await subirComprobanteCaja(form.archivo);
        movimiento.comprobanteUrl = url;
      }
      await agregarMovimientoCaja(movimiento);
      alert("Movimiento guardado ✅");
      setForm({
        tipo: "egreso",
        monto: "",
        descripcion: "",
        centroCosto: "",
        fecha: new Date().toISOString().split("T")[0],
        archivo: null,
      });
      const lista = await obtenerMovimientosCaja();
      setMovimientos(lista);
      calcularResumen(lista);
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setLoading(false);
  };

  const exportarExcel = () => {
    if (!movimientos.length) {
      alert("No hay movimientos para exportar");
      return;
    }

    const data = movimientosFiltrados.map((m) => ({
      Fecha: new Date(m.fecha).toLocaleDateString("es-PE"),
      Tipo: m.tipo,
      Monto: parseFloat(m.monto),
      "Centro de Costo": m.centroCosto,
      Descripción: m.descripcion,
      Usuario: m.usuario,
      "Comprobante URL": m.comprobanteUrl || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Caja Chica");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `CajaChica_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 🔍 FILTRO
  const movimientosFiltrados = movimientos.filter((m) => {
    const texto = `${m.descripcion} ${m.fecha}`.toLowerCase();
    const matchBusqueda = texto.includes(busqueda.toLowerCase());
    const matchCentro = filtroCentro ? m.centroCosto === filtroCentro : true;
    const matchTipo = filtroTipo ? m.tipo === filtroTipo : true;
    return matchBusqueda && matchCentro && matchTipo;
  });

  if (loading) return <div className="p-6">Cargando usuario.</div>;
  if (!usuario || !["gerencia", "operaciones"].includes(usuario?.rol)) return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">💵 Control de Caja Chica</h2>

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-green-100 p-4 rounded shadow">
          <p className="text-sm text-green-700">Ingresos</p>
          <p className="text-lg font-bold text-green-900">
            S/ {resumen.ingresos.toFixed(2)}
          </p>
        </div>
        <div className="bg-red-100 p-4 rounded shadow">
          <p className="text-sm text-red-700">Egresos</p>
          <p className="text-lg font-bold text-red-900">
            S/ {resumen.egresos.toFixed(2)}
          </p>
        </div>
        <div className="bg-blue-100 p-4 rounded shadow col-span-2 md:col-span-1">
          <p className="text-sm text-blue-700">Saldo Actual</p>
          <p className="text-lg font-bold text-blue-900">
            S/ {(resumen.ingresos - resumen.egresos).toFixed(2)}
          </p>
        </div>
      </div>

      {/* 💰 FORMULARIO */}
      <div className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="egreso">Egreso</option>
          <option value="ingreso">Ingreso</option>
        </select>

        <input
          type="number"
          placeholder="Monto"
          value={form.monto}
          onChange={(e) => setForm({ ...form, monto: e.target.value })}
          className="border p-2 rounded"
        />

        <select
          value={form.centroCosto}
          onChange={(e) => setForm({ ...form, centroCosto: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Centro de costo</option>
          {centros.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          className="border p-2 rounded"
        />

        <input
          type="text"
          placeholder="Descripción"
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          className="border p-2 rounded"
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <Upload size={18} />
          <span className="text-sm">
            {form.archivo?.name || "Subir comprobante"}
          </span>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) =>
              setForm({ ...form, archivo: e.target.files[0] })
            }
            className="hidden"
          />
        </label>

        <button
          onClick={handleGuardar}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded col-span-1 md:col-span-3"
        >
          Guardar movimiento
        </button>
      </div>

      {/* 🔍 FILTROS */}
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div className="flex items-center gap-2">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por fecha o descripción"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">Todos los tipos</option>
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </select>

        <select
          value={filtroCentro}
          onChange={(e) => setFiltroCentro(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">Todos los centros</option>
          {centros.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Exportar a Excel
        </button>
      </div>

      {/* 📋 LISTADO */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Fecha</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Monto</th>
              <th className="p-2">Centro</th>
              <th className="p-2">Descripción</th>
              <th className="p-2">Comprobante</th>
            </tr>
          </thead>
          <tbody>
            {movimientosFiltrados.map((m, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">
                  {format(new Date(m.fecha), "dd/MM/yyyy")}
                </td>
                <td className="p-2 capitalize">{m.tipo}</td>
                <td className="p-2">S/ {parseFloat(m.monto).toFixed(2)}</td>
                <td className="p-2">{m.centroCosto}</td>
                <td className="p-2">{m.descripcion}</td>
                <td className="p-2">
                  {m.comprobanteUrl ? (
                    <a
                      href={m.comprobanteUrl}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CajaChica;
