// ✅ src/pages/Proveedores.jsx
import React, { useEffect, useState } from "react";
import {
  obtenerProveedores,
  agregarProveedor,
  actualizarProveedor,
} from "../firebase/proveedoresHelpers";
import { consultarSunat } from "../utils/consultaSunat";
import { Pencil } from "lucide-react";
import CuentaBancariaForm from "../components/CuentaBancariaForm";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useUsuario } from "../context/UsuarioContext";

const Proveedores = () => {
  const { usuario, loading } = useUsuario();

  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState({
    ruc: "",
    razonSocial: "",
    direccion: "",
    telefono: "",
    email: "",
    contacto: "",
    bancos: [], // [{nombre, cuenta, cci, moneda}]
    estado: "Activo",
    motivoCambio: "",
  });
  const [editandoId, setEditandoId] = useState(null);
  const [cuenta, setCuenta] = useState({ nombre: "", cuenta: "", cci: "", moneda: "" });
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const porPagina = 10;

  useEffect(() => {
    if (!loading && usuario) cargarProveedores();
  }, [usuario, loading]);

  useEffect(() => {
    const buscarProveedor = async () => {
      if (form.ruc.length === 11 && form.razonSocial.trim() === "") {
        try {
          // usa tu util, ver opción B para proxy
          const data = await consultarSunat(form.ruc);
          setForm((prev) => ({ ...prev, razonSocial: data.razonSocial, direccion: data.direccion }));
        } catch (error) {
          console.warn("SUNAT CORS/Fetch falló, continúa manual:", error);
          // No alert, para no molestar; deja que el usuario escriba manual.
        }
      }
    };
    buscarProveedor();
  }, [form.ruc]);

  const cargarProveedores = async () => {
    const lista = await obtenerProveedores();
    const normalizados = (lista || []).map((p) => ({
      ...p,
      estado: p.estado || "Activo",
      bancos: Array.isArray(p.bancos) ? p.bancos : [], // seguridad
    }));
    setProveedores(normalizados);
  };

  const guardar = async () => {
    if (!form.ruc || !form.razonSocial) {
      alert("El RUC y la razón social son obligatorios");
      return;
    }

    try {
      if (editandoId) {
        if (form.estado !== "Activo" && !form.motivoCambio.trim()) {
          alert("Debes ingresar el motivo del cambio de estado");
          return;
        }
        await actualizarProveedor(editandoId, form);
        alert("Proveedor actualizado ✅");
      } else {
        await agregarProveedor(form);
        alert("Proveedor agregado ✅");
      }

      limpiarFormulario();
      cargarProveedores();
    } catch (e) {
      console.error("Error al guardar:", e);
      alert("Hubo un error");
    }
  };

  const limpiarFormulario = () => {
    setForm({
      ruc: "",
      razonSocial: "",
      direccion: "",
      telefono: "",
      email: "",
      contacto: "",
      bancos: [],
      estado: "Activo",
      motivoCambio: "",
    });
    setCuenta({ nombre: "", cuenta: "", cci: "", moneda: "" });
    setEditandoId(null);
  };

  const cargarParaEditar = (prov) => {
    setForm({ ...prov, motivoCambio: "" });
    setEditandoId(prov.id);
  };

  const proveedoresFiltrados = proveedores.filter((p) =>
    `${p.ruc} ${p.razonSocial}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalPaginas = Math.ceil(proveedoresFiltrados.length / porPagina);
  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;
  const proveedoresPaginados = proveedoresFiltrados.slice(inicio, fin);

  // ✅ Exportación en 2 hojas: "Proveedores" y "Cuentas"
  const exportarExcel = () => {
    if (!proveedoresFiltrados.length) {
      alert("No hay proveedores para exportar");
      return;
    }

    // Hoja 1: Proveedores (datos generales)
    const dataProveedores = proveedoresFiltrados.map((p) => ({
      RUC: p.ruc,
      "Razón Social": p.razonSocial,
      Dirección: p.direccion,
      Teléfono: p.telefono,
      Email: p.email,
      Contacto: p.contacto,
      Estado: p.estado || "Activo",
      // Opcional: conteo de cuentas
      "Nº Cuentas": Array.isArray(p.bancos) ? p.bancos.length : 0,
    }));

    // Hoja 2: Cuentas (una fila por cada cuenta)
    const dataCuentas = [];
    proveedoresFiltrados.forEach((p) => {
      (p.bancos || []).forEach((b) => {
        dataCuentas.push({
          RUC: p.ruc,
          "Razón Social": p.razonSocial,
          Banco: b.nombre || "",
          Moneda: b.moneda || "",
          Cuenta: b.cuenta || "",
          CCI: b.cci || "",
          Contacto: p.contacto || "",
          Email: p.email || "",
          EstadoProveedor: p.estado || "Activo",
        });
      });
      // Si un proveedor no tiene cuentas y quieres que aparezca igual en la hoja Cuentas,
      // descomenta esto:
      // if (!(p.bancos || []).length) {
      //   dataCuentas.push({
      //     RUC: p.ruc,
      //     "Razón Social": p.razonSocial,
      //     Banco: "",
      //     Moneda: "",
      //     Cuenta: "",
      //     CCI: "",
      //     Contacto: p.contacto || "",
      //     Email: p.email || "",
      //     EstadoProveedor: p.estado || "Activo",
      //   });
      // }
    });

    const wb = XLSX.utils.book_new();

    const wsProv = XLSX.utils.json_to_sheet(dataProveedores);
    XLSX.utils.book_append_sheet(wb, wsProv, "Proveedores");

    const wsCtas = XLSX.utils.json_to_sheet(dataCuentas);
    XLSX.utils.book_append_sheet(wb, wsCtas, "Cuentas");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `Proveedores_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return <div className="p-6">Cargando usuario.</div>;
  if (!usuario || !["admin", "comprador"].includes(usuario?.rol))
    return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Gestión de Proveedores</h2>

      {/* Formulario */}
      <div className="bg-white p-6 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="RUC"
          value={form.ruc}
          onChange={(e) => setForm({ ...form, ruc: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Razón Social"
          value={form.razonSocial}
          onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Dirección"
          value={form.direccion}
          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Teléfono"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Correo"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Contacto"
          value={form.contacto}
          onChange={(e) => setForm({ ...form, contacto: e.target.value })}
          className="border p-2 rounded"
        />

        {/* Estado + Motivo */}
        {editandoId && (
          <>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
            {form.estado === "Inactivo" && (
              <input
                type="text"
                placeholder="Motivo de inactivación"
                value={form.motivoCambio}
                onChange={(e) => setForm({ ...form, motivoCambio: e.target.value })}
                className="border p-2 rounded"
              />
            )}
          </>
        )}

        {/* Cuentas */}
        <CuentaBancariaForm
          cuenta={cuenta}
          setCuenta={setCuenta}
          cuentas={form.bancos}
          setCuentas={(bancos) => setForm((prev) => ({ ...prev, bancos }))}
        />

        <div className="col-span-2 flex gap-4 mt-4">
          <button
            onClick={guardar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {editandoId ? "Actualizar" : "Agregar"}
          </button>
          {editandoId && (
            <button
              className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
              onClick={limpiarFormulario}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Filtro y export */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por RUC o razón social..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPaginaActual(1);
          }}
          className="border px-3 py-2 rounded w-full md:w-1/2"
        />
        <button
          onClick={exportarExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full md:w-auto"
        >
          Exportar a Excel
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">RUC</th>
              <th className="p-2 text-left">Razón Social</th>
              <th className="p-2 text-left">Contacto</th>
              <th className="p-2 text-left">Correo</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedoresPaginados.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No hay proveedores.
                </td>
              </tr>
            ) : (
              proveedoresPaginados.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{p.ruc}</td>
                  <td className="p-2">{p.razonSocial}</td>
                  <td className="p-2">{p.contacto}</td>
                  <td className="p-2">{p.email}</td>
                  <td className="p-2">{p.estado || "Activo"}</td>
                  <td className="p-2">
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      title="Editar"
                      onClick={() => cargarParaEditar(p)}
                    >
                      <Pencil size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaActual === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <span>
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              onClick={() =>
                setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))
              }
              disabled={paginaActual === totalPaginas}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Proveedores;
