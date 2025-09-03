// ✅ src/pages/CajaChica.jsx
import React, { useEffect, useMemo, useState } from "react";
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
import { useUsuario } from "../context/UsuarioContext";

const ROLES_PERMITIDOS = ["admin", "gerencia", "operaciones", "administración"];

const CajaChica = () => {
  const { usuario, cargando: loadingUser } = useUsuario();

  // ▷ Caja seleccionada (separadas por negocio)
  const [cajaSeleccionada, setCajaSeleccionada] = useState("administrativa"); // administrativa | operativa

  // ▷ Datos UI
  const [centros, setCentros] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState({ ingresos: 0, egresos: 0 });
  const [guardando, setGuardando] = useState(false);

  // ▷ Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  // ▷ Form
  const [form, setForm] = useState({
    tipo: "egreso",
    monto: "",
    descripcion: "",
    centroCosto: "",
    fecha: new Date().toISOString().split("T")[0], // yyyy-mm-dd
    archivo: null,
  });

  // ▷ Caja por defecto según rol
  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "administración") {
      setCajaSeleccionada("administrativa");
    } else if (usuario.rol === "operaciones") {
      setCajaSeleccionada("operativa");
    } else {
      // admin/gerencia: mantener lo que esté (por defecto administrativa)
    }
  }, [usuario]);

  // ▷ Cargar catálogos + movimientos por caja
  useEffect(() => {
    const cargar = async () => {
      const centrosDB = await obtenerCentrosCosto();
      setCentros(centrosDB.map((c) => c.nombre));

      if (cajaSeleccionada) {
        const lista = await obtenerMovimientosCaja(cajaSeleccionada);
        setMovimientos(lista);
        calcularResumen(lista);
      }
    };
    cargar();
  }, [cajaSeleccionada]);

  const calcularResumen = (data) => {
    const ingresos = data
      .filter((m) => m.tipo === "ingreso")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const egresos = data
      .filter((m) => m.tipo === "egreso")
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);
    setResumen({ ingresos, egresos });
  };

  const handleGuardar = async () => {
    if (!form.monto || !form.centroCosto || !form.descripcion) {
      alert("Completa todos los campos obligatorios.");
      return;
    }
    if (!cajaSeleccionada) {
      alert("Selecciona una caja.");
      return;
    }

    const movimiento = {
      ...form,
      monto: parseFloat(form.monto),
      usuario: localStorage.getItem("userEmail"),
    };

    setGuardando(true);
    try {
      if (form.archivo) {
        const nombreBase = `${Date.now()}_${movimiento.usuario || "user"}`;
        const url = await subirComprobanteCaja(
          cajaSeleccionada,
          form.archivo,
          nombreBase
        );
        movimiento.comprobanteUrl = url;
      }

      await agregarMovimientoCaja(cajaSeleccionada, movimiento);

      // Reset form
      setForm({
        tipo: "egreso",
        monto: "",
        descripcion: "",
        centroCosto: "",
        fecha: new Date().toISOString().split("T")[0],
        archivo: null,
      });

      // Recargar lista
      const lista = await obtenerMovimientosCaja(cajaSeleccionada);
      setMovimientos(lista);
      calcularResumen(lista);

      alert("Movimiento guardado ✅");
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setGuardando(false);
  };

  // 🔍 FILTRO
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      const fechaObj = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
      const fechaStr = isNaN(fechaObj) ? "" : format(fechaObj, "yyyy-MM-dd");
      const texto = `${m.descripcion || ""} ${fechaStr}`.toLowerCase();

      const matchBusqueda = texto.includes((busqueda || "").toLowerCase());
      const matchCentro = filtroCentro ? m.centroCosto === filtroCentro : true;
      const matchTipo = filtroTipo ? m.tipo === filtroTipo : true;
      return matchBusqueda && matchCentro && matchTipo;
    });
  }, [movimientos, busqueda, filtroCentro, filtroTipo]);

  const exportarExcel = () => {
    if (!movimientosFiltrados.length) {
      alert("No hay movimientos para exportar");
      return;
    }

    const data = movimientosFiltrados.map((m) => {
      const fechaObj = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
      const fechaFmt = isNaN(fechaObj) ? "" : fechaObj.toLocaleDateString("es-PE");
      return {
        Caja: cajaSeleccionada,
        Fecha: fechaFmt,
        Tipo: m.tipo,
        Monto: parseFloat(m.monto || 0),
        "Centro de Costo": m.centroCosto,
        Descripción: m.descripcion,
        Usuario: m.usuario,
        "Comprobante URL": m.comprobanteUrl || "—",
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Caja ${cajaSeleccionada}`);

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `Caja_${cajaSeleccionada}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ▷ Acceso por rol (admin ve ambas; gerencia ve ambas; operaciones → operativa; administracion → administrativa)
  if (loadingUser) return <div className="p-6">Cargando usuario...</div>;
  if (
    !usuario ||
    !ROLES_PERMITIDOS.includes(usuario?.rol)
  ) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

  const puedeCambiarCaja =
    usuario.rol === "admin" || usuario.rol === "gerencia";

  const opcionesCaja = [
    { value: "administrativa", label: "Administrativa" },
    { value: "operativa", label: "Operativa" },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-bold">Control de Caja Chica</h2>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Caja:</span>
          <select
            value={cajaSeleccionada}
            onChange={(e) => setCajaSeleccionada(e.target.value)}
            className="border p-2 rounded"
            disabled={!puedeCambiarCaja}
            title={
              puedeCambiarCaja
                ? "Cambiar caja"
                : "Tu rol solo permite esta caja"
            }
          >
            {opcionesCaja
              .filter((opt) => {
                if (usuario.rol === "operaciones") return opt.value === "operativa";
                if (usuario.rol === "administracion") return opt.value === "administrativa";
                return true; // admin/gerencia
              })
              .map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Resumen */}
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

      {/* Formulario */}
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
              setForm({ ...form, archivo: e.target.files?.[0] || null })
            }
            className="hidden"
          />
        </label>

        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded col-span-1 md:col-span-3"
        >
          {guardando ? "Guardando..." : "Guardar movimiento"}
        </button>
      </div>

      {/* Filtros */}
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

      {/* Listado */}
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
            {movimientosFiltrados.map((m) => {
              const fechaObj = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
              const fechaFmt = isNaN(fechaObj) ? "—" : format(fechaObj, "dd/MM/yyyy");
              return (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{fechaFmt}</td>
                  <td className="p-2 capitalize">{m.tipo}</td>
                  <td className="p-2">S/ {parseFloat(m.monto || 0).toFixed(2)}</td>
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
              );
            })}
            {movimientosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CajaChica;
