// ✅ src/pages/Proveedores.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { PageLoader } from "../components/ui/Skeleton";
import {
  obtenerProveedores,
  agregarProveedor,
  actualizarProveedor,
} from "../firebase/proveedoresHelpers";
import { consultarSunat } from "../utils/consultaSunat";
import { Pencil } from "lucide-react";
import CuentaBancariaForm from "../components/CuentaBancariaForm";
import { exportExcelMultiHoja, exportCSV, exportPDF } from "../utils/exportUtils";
import ExportMenu from "../components/ExportMenu";
import { useUsuario } from "../context/UsuarioContext";

const esRucValido = (raw) => {
  const ruc = (raw || "").replace(/\D/g, "");
  if (ruc.length !== 11) return false;
  // checksum rápido (mod 11)
  const factores = [5,4,3,2,7,6,5,4,3,2];
  const suma = factores.reduce((acc, f, i) => acc + f * parseInt(ruc[i], 10), 0);
  const resto = suma % 11;
  const dig = 11 - resto;
  const dv = (dig === 10) ? 0 : (dig === 11 ? 1 : dig);
  return dv === parseInt(ruc[10], 10);
};

const Proveedores = () => {
  const { usuario, cargando: loading } = useUsuario();

  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState({
    tipoProv: "Domiciliado", // "Domiciliado" | "No Domiciliado"
    ruc: "",
    idFiscal: "",           // Tax ID / EIN para no domiciliados
    paisOrigen: "",         // País de origen para no domiciliados
    razonSocial: "",
    direccion: "",
    telefono: "",
    email: "",
    contacto: "",
    bancos: [], // [{nombre, cuenta, cci, moneda}]
    estado: "Activo",
    motivoCambio: "",
    // Campos provenientes de SUNAT
    sunatEstado: "",
    sunatCondicion: "",
    sunatDepartamento: "",
    exoneradoIGV: false,
  });

  const esNoDomiciliado = form.tipoProv === "No Domiciliado";
  const [editandoId, setEditandoId] = useState(null);
  const [cuenta, setCuenta] = useState({ nombre: "", cuenta: "", cci: "", moneda: "" });

  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const porPagina = 10;

  // estados lookup SUNAT
  const [buscandoRuc, setBuscandoRuc] = useState(false);
  const [errorSunat, setErrorSunat] = useState("");

  useEffect(() => {
    if (!loading && usuario) cargarProveedores();
  }, [usuario, loading]);

  const cargarProveedores = async () => {
    const lista = await obtenerProveedores();
    const normalizados = (lista || []).map((p) => ({
      ...p,
      estado: p.estado || "Activo",
      bancos: Array.isArray(p.bancos) ? p.bancos : [],
    }));
    setProveedores(normalizados);
  };

  // --- Handlers RUC ---
  const handleRucChange = (e) => {
    const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 11);
    setForm((prev) => ({ ...prev, ruc: onlyDigits }));
    setErrorSunat("");
  };

  const DEPARTAMENTOS_AMAZONIA = [
    "LORETO",
    "UCAYALI",
    "MADRE DE DIOS",
    "AMAZONAS",
    "SAN MARTIN",
  ];

  const handleRucBlur = async () => {
    if (!form.ruc || form.ruc.length !== 11) return;
    if (!esRucValido(form.ruc)) {
      setErrorSunat("RUC inválido. Verifica los 11 dígitos.");
      return;
    }

    try {
      setBuscandoRuc(true);
      setErrorSunat("");
      const data = await consultarSunat(form.ruc);

      const sunatEstado = (data.estado || "").toUpperCase();
      const sunatCondicion = (data.condicion || "").toUpperCase();
      const sunatDepartamento = (data.departamento || "").toUpperCase();
      const exoneradoIGV = DEPARTAMENTOS_AMAZONIA.includes(sunatDepartamento);

      setForm((prev) => ({
        ...prev,
        // Solo rellenar razonSocial y direccion si aún no tienen valor
        razonSocial: prev.razonSocial?.trim() ? prev.razonSocial : (data.razonSocial || prev.razonSocial),
        direccion: prev.direccion?.trim() ? prev.direccion : (data.direccion || prev.direccion),
        sunatEstado,
        sunatCondicion,
        sunatDepartamento,
        exoneradoIGV,
      }));

      // Avisos de estado SUNAT
      if (sunatEstado && sunatEstado !== "ACTIVO") {
        toast.warning("Proveedor con estado BAJA en SUNAT");
      }
      if (sunatCondicion && sunatCondicion !== "HABIDO") {
        toast.warning("Proveedor NO HABIDO en SUNAT");
      }
    } catch (error) {
      console.error("Fallo consulta SUNAT:", error);
      setErrorSunat("No se pudo validar con SUNAT. Completa los campos manualmente.");
    } finally {
      setBuscandoRuc(false);
    }
  };

  const guardar = async () => {
    if (!form.razonSocial.trim()) {
      toast.info("La razón social es obligatoria");
      return;
    }
    if (!esNoDomiciliado) {
      if (!form.ruc) {
        toast.info("El RUC es obligatorio para proveedores domiciliados");
        return;
      }
      if (!esRucValido(form.ruc)) {
        toast.warning("RUC inválido. Verifica los 11 dígitos.");
        return;
      }
    }

    try {
      if (editandoId) {
        if (form.estado !== "Activo" && !form.motivoCambio.trim()) {
          toast.warning("Debes ingresar el motivo del cambio de estado");
          return;
        }
        await actualizarProveedor(editandoId, form);
        toast.success("Proveedor actualizado ✅");
      } else {
        await agregarProveedor(form);
        toast.success("Proveedor agregado ✅");
      }

      limpiarFormulario();
      cargarProveedores();
    } catch (e) {
      console.error("Error al guardar:", e);
      toast.error("Hubo un error");
    }
  };

  const limpiarFormulario = () => {
    setForm({
      tipoProv: "Domiciliado",
      ruc: "",
      idFiscal: "",
      paisOrigen: "",
      razonSocial: "",
      direccion: "",
      telefono: "",
      email: "",
      contacto: "",
      bancos: [],
      estado: "Activo",
      motivoCambio: "",
      sunatEstado: "",
      sunatCondicion: "",
      sunatDepartamento: "",
      exoneradoIGV: false,
    });
    setCuenta({ nombre: "", cuenta: "", cci: "", moneda: "" });
    setEditandoId(null);
    setErrorSunat("");
    setBuscandoRuc(false);
  };

  const cargarParaEditar = (prov) => {
    setForm({ ...prov, motivoCambio: "" });
    setEditandoId(prov.id);
    setErrorSunat("");
    setBuscandoRuc(false);
  };

  const proveedoresFiltrados = useMemo(
    () =>
      (proveedores || []).filter((p) =>
        `${p.ruc || ""} ${p.idFiscal || ""} ${p.razonSocial || ""} ${p.paisOrigen || ""}`.toLowerCase().includes(busqueda.toLowerCase())
      ),
    [proveedores, busqueda]
  );

  const totalPaginas = Math.ceil(proveedoresFiltrados.length / porPagina);
  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;
  const proveedoresPaginados = proveedoresFiltrados.slice(inicio, fin);

  // Exportación multi-hoja (proveedores + cuentas)
  const exportarExcelProveedores = () => {
    if (!proveedoresFiltrados.length) return;
    const nombre = `proveedores-${new Date().toISOString().slice(0,10)}`;
    exportExcelMultiHoja([
      {
        hoja: "Proveedores",
        data: proveedoresFiltrados.map((p) => ({
          Tipo: p.tipoProv || "Domiciliado",
          RUC: p.ruc || "", "ID Fiscal": p.idFiscal || "", País: p.paisOrigen || "",
          "Razón Social": p.razonSocial, Dirección: p.direccion,
          Teléfono: p.telefono, Email: p.email, Contacto: p.contacto,
          Estado: p.estado || "Activo",
          "Nº Cuentas": Array.isArray(p.bancos) ? p.bancos.length : 0,
        })),
      },
      {
        hoja: "Cuentas Bancarias",
        data: proveedoresFiltrados.flatMap((p) =>
          (p.bancos || []).map((b) => ({
            RUC: p.ruc, "Razón Social": p.razonSocial,
            Banco: b.nombre || "", Moneda: b.moneda || "",
            Cuenta: b.cuenta || "", CCI: b.cci || "",
            Contacto: p.contacto || "", Email: p.email || "",
          }))
        ),
      },
    ], nombre);
  };

  const proveedoresExportData = proveedoresFiltrados.map((p) => ({
    tipo: p.tipoProv || "Domiciliado",
    ruc: p.ruc || "", idFiscal: p.idFiscal || "", pais: p.paisOrigen || "",
    razonSocial: p.razonSocial, direccion: p.direccion,
    telefono: p.telefono, email: p.email, contacto: p.contacto,
    estado: p.estado || "Activo",
  }));
  const proveedoresExportHeaders = {
    tipo: "Tipo", ruc: "RUC", idFiscal: "ID Fiscal", pais: "País",
    razonSocial: "Razón Social", direccion: "Dirección",
    telefono: "Teléfono", email: "Email", contacto: "Contacto", estado: "Estado",
  };

  if (loading) return <PageLoader />;
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Gestión de Proveedores</h2>

      {/* Formulario */}
      <div className="bg-white p-6 rounded shadow mb-6 space-y-4">

        {/* Toggle tipo proveedor */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {["Domiciliado", "No Domiciliado"].map((tipo) => (
            <button
              key={tipo}
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  tipoProv: tipo,
                  ruc: tipo === "No Domiciliado" ? "" : prev.ruc,
                  sunatEstado: tipo === "No Domiciliado" ? "" : prev.sunatEstado,
                  sunatCondicion: tipo === "No Domiciliado" ? "" : prev.sunatCondicion,
                  sunatDepartamento: tipo === "No Domiciliado" ? "" : prev.sunatDepartamento,
                  exoneradoIGV: tipo === "No Domiciliado" ? false : prev.exoneradoIGV,
                }));
                setErrorSunat("");
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                form.tipoProv === tipo
                  ? "bg-white text-[#004990] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* RUC (solo domiciliado) o ID Fiscal + País (no domiciliado) */}
        {!esNoDomiciliado ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">RUC *</label>
            <input
              type="text"
              placeholder="RUC (11 dígitos)"
              value={form.ruc}
              onChange={handleRucChange}
              onBlur={handleRucBlur}
              inputMode="numeric"
              pattern="\d{11}"
              maxLength={11}
              className="border p-2 rounded w-full"
            />
            <div className="h-5 mt-1 text-sm">
              {buscandoRuc && <span className="text-gray-500">Consultando SUNAT…</span>}
              {!buscandoRuc && errorSunat && (
                <span className="text-red-600">{errorSunat}</span>
              )}
            </div>

            {/* Badge de validación SUNAT */}
            {!buscandoRuc && form.sunatEstado && (
              <div className="flex flex-wrap gap-2 mt-1">
                {form.sunatEstado === "ACTIVO" && form.sunatCondicion === "HABIDO" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                    ✓ Activo | Habido
                  </span>
                ) : (
                  <>
                    {form.sunatEstado !== "ACTIVO" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-300">
                        ✗ BAJA
                      </span>
                    )}
                    {form.sunatCondicion && form.sunatCondicion !== "HABIDO" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-300">
                        ✗ No Habido
                      </span>
                    )}
                  </>
                )}
                {form.exoneradoIGV && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
                    Exonerado IGV (zona Amazónica)
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tax ID / EIN (opcional)</label>
              <input
                type="text"
                placeholder="Ej: EIN 12-3456789, VAT GB123456"
                value={form.idFiscal}
                onChange={(e) => setForm({ ...form, idFiscal: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">País de origen</label>
              <input
                type="text"
                placeholder="Ej: Estados Unidos, Singapur"
                value={form.paisOrigen}
                onChange={(e) => setForm({ ...form, paisOrigen: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Razón Social *</label>
          <input
            type="text"
            placeholder="Razón Social / Company Name"
            value={form.razonSocial}
            onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
            className="border p-2 rounded w-full"
          />
        </div>
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
        </div>{/* cierre grid */}
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
        <div className="flex gap-2">
          <button
            onClick={exportarExcelProveedores}
            disabled={!proveedoresFiltrados.length}
            className="btn btn-export btn-sm disabled:opacity-50"
          >
            Excel (2 hojas)
          </button>
          <ExportMenu
            data={proveedoresExportData}
            nombre={`proveedores-${new Date().toISOString().slice(0,10)}`}
            titulo="Proveedores"
            headers={proveedoresExportHeaders}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">RUC / ID Fiscal</th>
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
                <td colSpan="7" className="p-4 text-center text-gray-500">
                  No hay proveedores.
                </td>
              </tr>
            ) : (
              proveedoresPaginados.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    {p.tipoProv === "No Domiciliado" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        Extranjero
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        Nacional
                      </span>
                    )}
                  </td>
                  <td className="p-2 font-mono text-sm">
                    {p.ruc || p.idFiscal || <span className="text-gray-300">—</span>}
                    {p.paisOrigen && <span className="ml-1 text-xs text-gray-400">({p.paisOrigen})</span>}
                  </td>
                  <td className="p-2">{p.razonSocial}</td>
                  <td className="p-2">{p.contacto}</td>
                  <td className="p-2">{p.email}</td>
                  <td className="p-2">{p.estado || "Activo"}</td>
                  <td className="p-2">
                    <button
                      className="text-blue-600 hover:text-black"
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
