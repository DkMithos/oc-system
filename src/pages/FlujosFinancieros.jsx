// src/pages/FlujosFinancieros.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  obtenerCatalogosFinanzas,
  obtenerTransaccionesFinancieras,
  crearTransaccionFinanciera,
  actualizarTransaccionFinanciera,
  subirAdjuntoFinanzas,
  TIPO_TRANSACCION,
  CLASIFICACION_TRANSACCION,
  obtenerProveedoresLigero,
  obtenerCentrosCostoLigero,
  buscarOrdenesCompraPorNumero,
} from "../firebase/finanzasHelpers";
import { useUsuario } from "../context/UsuarioContext";

const baseInputClass =
  "bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm " +
  "focus:outline-none focus:ring-1 focus:ring-[#004990] focus:border-[#004990] " +
  "transition shadow-sm";
const baseSelectClass =
  "bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm " +
  "focus:outline-none focus:ring-1 focus:ring-[#004990] focus:border-[#004990] " +
  "transition shadow-sm appearance-none pr-7";

const initialFilters = () => {
  const hoy = new Date();
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return {
    fechaDesde: toISO(hace30),
    fechaHasta: toISO(hoy),
    tipo: "",
    estado: "",
    categoriaId: "",
    centro_costo_id: "",
  };
};

const initialFormState = (usuario) => ({
  id: null,
  tipo: TIPO_TRANSACCION.EGRESO,
  clasificacion: CLASIFICACION_TRANSACCION.OPEX,
  categoriaId: "",
  subcategoriaId: "",
  moneda: "PEN",
  tc: "",
  monto_sin_igv: "",
  igvCodigo: "",
  igvTasa: "",
  monto_total: "",
  forma_pago: "",
  // Proveedor / cliente
  proveedor_cliente_id: "",
  proveedor_cliente_nombre: "",
  proveedorSearch: "",
  // Centro de costo
  centro_costo_id: "",
  centro_costo_nombre: "",
  centro_costo_search: "",
  // Proyecto
  proyecto_id: "",
  proyecto_nombre: "",
  // Documento
  documento_tipo: "",
  documento_numero: "",
  // Orden relacionada
  oc_id: "",
  oc_numero: "",
  // Factura (si aplica)
  facturaId: "",
  estado: "",
  fecha: new Date().toISOString().slice(0, 10),
  programado_fecha: "",
  notas: "",
  adjuntoFile: null,
  creadoPor: usuario?.nombreCompleto || usuario?.email || "",
  creadoPorUid: usuario?.uid || "",
});

function FlujosFinancieros() {
  const { usuario } = useUsuario();

  const [catalogos, setCatalogos] = useState({
    igv: [],
    categorias: [],
    subcategorias: [],
    formasPago: [],
    estados: [],
    tiposDocumento: [],
    proyectos: [],
  });

  const [proveedores, setProveedores] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);

  const [filtros, setFiltros] = useState(initialFilters);
  const [transacciones, setTransacciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [error, setError] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [form, setForm] = useState(() => initialFormState(usuario));
  const [guardando, setGuardando] = useState(false);

  const [buscandoOc, setBuscandoOc] = useState(false);
  const [ocError, setOcError] = useState("");

  // Cargar catálogos
  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargandoCatalogos(true);
      try {
        const data = await obtenerCatalogosFinanzas();
        if (!activo) return;
        setCatalogos((prev) => ({
          ...prev,
          ...data,
        }));
      } catch (e) {
        console.error(e);
        if (activo) setError("Error cargando catálogos financieros.");
      } finally {
        if (activo) setCargandoCatalogos(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  // Cargar proveedores y centros de costo
  useEffect(() => {
    let activo = true;
    const cargarExtras = async () => {
      try {
        const [provs, ccs] = await Promise.all([
          obtenerProveedoresLigero(),
          obtenerCentrosCostoLigero(),
        ]);
        if (!activo) return;
        setProveedores(provs);
        setCentrosCosto(ccs);
      } catch (e) {
        console.error(e);
      }
    };
    cargarExtras();
    return () => {
      activo = false;
    };
  }, []);

  // Cargar transacciones
  const cargarTransacciones = async () => {
    setCargando(true);
    setError("");
    try {
      const { transacciones } = await obtenerTransaccionesFinancieras({
        fechaDesde: filtros.fechaDesde || null,
        fechaHasta: filtros.fechaHasta || null,
        tipo: filtros.tipo || null,
        estado: filtros.estado || null,
        categoriaId: filtros.categoriaId || null,
        centro_costo_id: filtros.centro_costo_id || null,
      });
      setTransacciones(transacciones);
    } catch (e) {
      console.error(e);
      setError("Error cargando transacciones financieras.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTransacciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resumen
  const resumen = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;

    transacciones.forEach((t) => {
      const totalPen =
        t.monto_total_pen != null
          ? Number(t.monto_total_pen)
          : Number(t.monto_total || 0);

      if (t.tipo === TIPO_TRANSACCION.INGRESO) {
        ingresos += totalPen;
      } else if (t.tipo === TIPO_TRANSACCION.EGRESO) {
        egresos += totalPen;
      }
    });

    const flujoNeto = ingresos - egresos;

    return {
      ingresos: +ingresos.toFixed(2),
      egresos: +egresos.toFixed(2),
      flujoNeto: +flujoNeto.toFixed(2),
    };
  }, [transacciones]);

  // Filtros
  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const handleBuscarClick = () => {
    cargarTransacciones();
  };

  const handleLimpiarFiltros = () => {
    setFiltros(initialFilters());
    setTimeout(() => {
      cargarTransacciones();
    }, 0);
  };

  // Modal / form
  const handleNuevoClick = () => {
    setForm(initialFormState(usuario));
    setOcError("");
    setMostrarModal(true);
  };

  const handleEditarClick = (t) => {
    setForm({
      ...initialFormState(usuario),
      ...t,
      fecha: t.fechaISO || t.fecha || new Date().toISOString().slice(0, 10),
      programado_fecha: t.programado_fechaISO || "",
      id: t.id,
      adjuntoFile: null,
      proveedorSearch:
        t.proveedor_cliente_nombre || t.proveedor_cliente_id || "",
      centro_costo_search: t.centro_costo_nombre || "",
    });
    setOcError("");
    setMostrarModal(true);
  };

  const handleChangeForm = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      // 🔗 Si cambia categoría, limpiamos subcategoría
      if (name === "categoriaId") {
        return {
          ...prev,
          categoriaId: value,
          subcategoriaId: "",
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({
      ...prev,
      adjuntoFile: file,
    }));
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setForm(initialFormState(usuario));
    setOcError("");
  };

  // Proveedor (input + datalist)
  const handleProveedorInputChange = (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const match = proveedores.find((p) => {
        const label = `${p.razonSocial} - ${p.ruc}`.trim();
        return label === value || p.ruc === value;
      });
      if (match) {
        return {
          ...prev,
          proveedorSearch: value,
          proveedor_cliente_id: match.ruc,
          proveedor_cliente_nombre: match.razonSocial,
        };
      }
      return {
        ...prev,
        proveedorSearch: value,
        proveedor_cliente_id: "",
        proveedor_cliente_nombre: value || "",
      };
    });
  };

  // Centro de costo (input + datalist)
  const handleCentroCostoInputChange = (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const cc = centrosCosto.find((c) => c.nombre === value);
      if (cc) {
        return {
          ...prev,
          centro_costo_search: value,
          centro_costo_id: cc.id,
          centro_costo_nombre: cc.nombre,
        };
      }
      return {
        ...prev,
        centro_costo_search: value,
        centro_costo_id: "",
        centro_costo_nombre: value || "",
      };
    });
  };

  // Proyecto (catálogo)
  const handleProyectoChange = (e) => {
    const value = e.target.value;
    const p = catalogos.proyectos.find((proy) => proy.id === value);
    setForm((prev) => ({
      ...prev,
      proyecto_id: value || "",
      proyecto_nombre: p?.nombre || "",
    }));
  };

  // Determinar IGV según cat/sub
  const resolverIgvCodigo = () => {
    const { categoriaId, subcategoriaId, igvCodigo } = form;
    const sub = catalogos.subcategorias.find((s) => s.id === subcategoriaId);
    if (sub?.igvCodigoDefault) return sub.igvCodigoDefault;
    const cat = catalogos.categorias.find((c) => c.id === categoriaId);
    if (cat?.igvCodigoDefault) return cat.igvCodigoDefault;
    return igvCodigo || "";
  };

  // Buscar OC y autocompletar datos ligados
  const handleBuscarOc = async () => {
    setOcError("");
    if (!form.oc_numero) {
      setOcError("Ingrese el número de orden para buscar.");
      return;
    }
    setBuscandoOc(true);
    try {
      const resultados = await buscarOrdenesCompraPorNumero(
        form.oc_numero.trim(),
      );
      if (!resultados || resultados.length === 0) {
        setOcError("No se encontró ninguna orden con ese número.");
        return;
      }
      const oc = resultados[0];

      setForm((prev) => ({
        ...prev,
        oc_id: oc.id,
        oc_numero: oc.numero || oc.oc_numero || prev.oc_numero,
        // Proveedor
        proveedor_cliente_id: oc.proveedorRuc || prev.proveedor_cliente_id,
        proveedor_cliente_nombre:
          oc.proveedorNombre || prev.proveedor_cliente_nombre,
        proveedorSearch:
          oc.proveedorNombre && oc.proveedorRuc
            ? `${oc.proveedorNombre} - ${oc.proveedorRuc}`
            : prev.proveedorSearch,
        // Centro de costo
        centro_costo_id: oc.centroCostoId || prev.centro_costo_id,
        centro_costo_nombre:
          oc.centroCostoNombre || prev.centro_costo_nombre,
        centro_costo_search:
          oc.centroCostoNombre || prev.centro_costo_search,
        // Proyecto
        proyecto_id: oc.proyectoId || prev.proyecto_id,
        proyecto_nombre: oc.proyectoNombre || prev.proyecto_nombre,
        // Moneda
        moneda: oc.moneda || prev.moneda,
      }));
    } catch (e) {
      console.error(e);
      setOcError("Error buscando la orden. Revisa la consola.");
    } finally {
      setBuscandoOc(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!usuario) return;

    setGuardando(true);
    setError("");

    try {
      const igvCodigo = resolverIgvCodigo();

      const cat = catalogos.categorias.find(
        (c) => c.id === form.categoriaId,
      );
      const sub = catalogos.subcategorias.find(
        (s) => s.id === form.subcategoriaId,
      );
      const estadoObj = catalogos.estados.find(
        (s) => s.nombre === form.estado,
      );

      const payloadBase = {
        tipo: form.tipo,
        clasificacion: form.clasificacion,
        categoriaId: form.categoriaId || null,
        categoriaNombre:
          cat?.nombre || cat?.descripcion || cat?.codigo || "",
        subcategoriaId: form.subcategoriaId || null,
        subcategoriaNombre:
          sub?.nombre || sub?.descripcion || sub?.codigo || "",
        moneda: form.moneda,
        tc: form.tc ? Number(form.tc) : null,
        monto_sin_igv: form.monto_sin_igv
          ? Number(form.monto_sin_igv)
          : 0,
        igvCodigo: igvCodigo || null,
        forma_pago: form.forma_pago || "",
        // Proveedor / cliente
        proveedor_cliente_id: form.proveedor_cliente_id || null,
        proveedor_cliente_nombre:
          form.proveedor_cliente_nombre || form.proveedorSearch || "",
        // Centro de costo
        centro_costo_id: form.centro_costo_id || null,
        centro_costo_nombre:
          form.centro_costo_nombre || form.centro_costo_search || "",
        // Proyecto
        proyecto_id: form.proyecto_id || null,
        proyecto_nombre: form.proyecto_nombre || "",
        // Documento
        documento_tipo: form.documento_tipo || "",
        documento_numero: form.documento_numero || "",
        // Orden relacionada
        oc_id: form.oc_id || null,
        oc_numero: form.oc_numero || "",
        // Factura
        facturaId: form.facturaId || null,
        // Estado
        estado: estadoObj?.nombre || form.estado || "",
        // Fechas
        fecha: form.fecha ? new Date(form.fecha) : new Date(),
        programado_fecha: form.programado_fecha
          ? new Date(form.programado_fecha)
          : null,
        notas: form.notas || "",
        creadoPor:
          form.creadoPor ||
          usuario?.nombreCompleto ||
          usuario?.email ||
          "",
        creadoPorUid: form.creadoPorUid || usuario?.uid || "",
      };

      let idTransaccion = form.id || null;

      if (!idTransaccion) {
        idTransaccion = await crearTransaccionFinanciera({
          ...payloadBase,
          igvCodigo,
        });
      } else {
        await actualizarTransaccionFinanciera(idTransaccion, {
          ...payloadBase,
          igvCodigo,
        });
      }

      if (form.adjuntoFile && idTransaccion) {
        const adj = await subirAdjuntoFinanzas(
          form.adjuntoFile,
          idTransaccion,
        );
        await actualizarTransaccionFinanciera(idTransaccion, {
          adjuntos: [adj],
        });
      }

      await cargarTransacciones();
      cerrarModal();
    } catch (e) {
      console.error(e);
      setError("Error guardando la transacción financiera.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-1">
        Flujos financieros
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              name="fechaDesde"
              value={filtros.fechaDesde}
              onChange={handleFiltroChange}
              className={baseInputClass}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              name="fechaHasta"
              value={filtros.fechaHasta}
              onChange={handleFiltroChange}
              className={baseInputClass}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Tipo</label>
            <div className="relative">
              <select
                name="tipo"
                value={filtros.tipo}
                onChange={handleFiltroChange}
                className={baseSelectClass}
              >
                <option value="">Todos</option>
                <option value={TIPO_TRANSACCION.INGRESO}>Ingresos</option>
                <option value={TIPO_TRANSACCION.EGRESO}>Egresos</option>
              </select>
              <ChevronDownIcon />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Estado</label>
            <div className="relative">
              <select
                name="estado"
                value={filtros.estado}
                onChange={handleFiltroChange}
                className={baseSelectClass}
              >
                <option value="">Todos</option>
                {catalogos.estados.map((e) => (
                  <option
                    key={e.id || e.nombre}
                    value={e.nombre || e.descripcion}
                  >
                    {e.nombre || e.descripcion || e.codigo || e.id}
                  </option>
                ))}
              </select>
              <ChevronDownIcon />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Categoría</label>
            <div className="relative">
              <select
                name="categoriaId"
                value={filtros.categoriaId}
                onChange={handleFiltroChange}
                className={baseSelectClass}
              >
                <option value="">Todas</option>
                {catalogos.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre || c.descripcion || c.codigo || c.id}
                  </option>
                ))}
              </select>
              <ChevronDownIcon />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2 justify-end">
          <button
            type="button"
            onClick={handleBuscarClick}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-medium text-white shadow-sm"
          >
            {cargando ? "Buscando..." : "Aplicar filtros"}
          </button>
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-medium text-gray-700 border border-gray-300"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResumenCard titulo="Ingresos" valor={resumen.ingresos} />
        <ResumenCard titulo="Egresos" valor={resumen.egresos} />
        <ResumenCard titulo="Flujo neto" valor={resumen.flujoNeto} resaltado />
      </div>

      {/* Acciones */}
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-gray-500">
          {cargandoCatalogos && "Cargando catálogos..."}
        </span>
        <button
          type="button"
          onClick={handleNuevoClick}
          className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-medium text-white shadow-sm"
        >
          Nueva transacción
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto mt-2 shadow-sm">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Moneda</Th>
              <Th className="text-right">Monto</Th>
              <Th>Categoría</Th>
              <Th>Subcategoría</Th>
              <Th>Estado</Th>
              <Th>Doc</Th>
              <Th>OC</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {transacciones.length === 0 && !cargando && (
              <tr>
                <td colSpan={10} className="text-center text-gray-500 py-3">
                  No hay transacciones en el rango seleccionado.
                </td>
              </tr>
            )}

            {transacciones.map((t) => (
              <tr
                key={t.id}
                className="border-t border-gray-100 hover:bg-gray-50"
              >
                <Td>{t.fechaISO || ""}</Td>
                <Td>{t.tipo}</Td>
                <Td>{t.moneda}</Td>
                <Td className="text-right">
                  {Number(
                    t.monto_total_pen ?? t.monto_total ?? 0,
                  ).toLocaleString("es-PE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Td>
                <Td>{t.categoriaNombre}</Td>
                <Td>{t.subcategoriaNombre}</Td>
                <Td>{t.estado}</Td>
                <Td>
                  {t.documento_tipo} {t.documento_numero}
                </Td>
                <Td>{t.oc_numero || t.ordenNumero || ""}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={() => handleEditarClick(t)}
                    className="text-blue-600 hover:text-blue-500 text-xs font-medium"
                  >
                    Ver / Editar
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <Modal onClose={cerrarModal}>
          <form
            onSubmit={handleSubmitForm}
            className="space-y-3 max-h-[80vh] overflow-y-auto pr-1"
          >
            <h2 className="text-lg font-semibold mb-1 text-gray-800">
              {form.id ? "Editar transacción" : "Nueva transacción"}
            </h2>

            {/* Tipo / clasif / estado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Tipo</label>
                <div className="relative">
                  <select
                    name="tipo"
                    value={form.tipo}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value={TIPO_TRANSACCION.INGRESO}>INGRESO</option>
                    <option value={TIPO_TRANSACCION.EGRESO}>EGRESO</option>
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Clasificación
                </label>
                <div className="relative">
                  <select
                    name="clasificacion"
                    value={form.clasificacion}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value={CLASIFICACION_TRANSACCION.OPEX}>
                      OPEX
                    </option>
                    <option value={CLASIFICACION_TRANSACCION.CAPEX}>
                      CAPEX
                    </option>
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Estado</label>
                <div className="relative">
                  <select
                    name="estado"
                    value={form.estado}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value="">Seleccione...</option>
                    {catalogos.estados.map((e) => (
                      <option
                        key={e.id || e.nombre}
                        value={e.nombre || e.descripcion}
                      >
                        {e.nombre || e.descripcion || e.codigo || e.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  name="fecha"
                  value={form.fecha}
                  onChange={handleChangeForm}
                  className={baseInputClass}
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Fecha programada (pago)
                </label>
                <input
                  type="date"
                  name="programado_fecha"
                  value={form.programado_fecha}
                  onChange={handleChangeForm}
                  className={baseInputClass}
                />
              </div>
            </div>

            {/* Categorías */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Categoría</label>
                <div className="relative">
                  <select
                    name="categoriaId"
                    value={form.categoriaId}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value="">Seleccione...</option>
                    {catalogos.categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre || c.descripcion || c.codigo || c.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Subcategoría
                </label>
                <div className="relative">
                  <select
                    name="subcategoriaId"
                    value={form.subcategoriaId}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value="">Seleccione...</option>
                    {catalogos.subcategorias
                      .filter(
                        (s) =>
                          !form.categoriaId ||
                          s.categoriaId === form.categoriaId,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre || s.descripcion || s.codigo || s.id}
                        </option>
                      ))}
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
            </div>

            {/* Montos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Moneda</label>
                <div className="relative">
                  <select
                    name="moneda"
                    value={form.moneda}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  TC (si no es PEN)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  name="tc"
                  value={form.tc}
                  onChange={handleChangeForm}
                  className={baseInputClass}
                  placeholder="Opcional si PEN"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Monto sin IGV
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="monto_sin_igv"
                  value={form.monto_sin_igv}
                  onChange={handleChangeForm}
                  className={baseInputClass}
                  required
                />
              </div>
            </div>

            {/* Forma de pago / doc */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Forma de pago
                </label>
                <div className="relative">
                  <select
                    name="forma_pago"
                    value={form.forma_pago}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value="">Seleccione...</option>
                    {catalogos.formasPago.map((f) => (
                      <option
                        key={f.id || f.nombre}
                        value={f.nombre || f.codigo}
                      >
                        {f.nombre || f.descripcion || f.codigo || f.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Tipo de documento
                </label>
                <div className="relative">
                  <select
                    name="documento_tipo"
                    value={form.documento_tipo}
                    onChange={handleChangeForm}
                    className={baseSelectClass}
                  >
                    <option value="">Seleccione...</option>
                    {catalogos.tiposDocumento.map((td) => (
                      <option key={td.id} value={td.nombre}>
                        {td.nombre || td.descripcion || td.codigo || td.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  N° documento
                </label>
                <input
                  type="text"
                  name="documento_numero"
                  value={form.documento_numero}
                  onChange={handleChangeForm}
                  className={baseInputClass}
                  placeholder="F001-000123"
                />
              </div>
            </div>

            {/* Proveedor / CC / Proyecto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Proveedor */}
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Proveedor / Cliente
                </label>
                <input
                  type="text"
                  name="proveedorSearch"
                  list="proveedores-list"
                  value={form.proveedorSearch}
                  onChange={handleProveedorInputChange}
                  className={baseInputClass}
                  placeholder="Escriba razón social o RUC"
                />
                <datalist id="proveedores-list">
                  {proveedores.map((p) => (
                    <option
                      key={p.id}
                      value={`${p.razonSocial} - ${p.ruc}`}
                    />
                  ))}
                </datalist>
                {form.proveedor_cliente_nombre && (
                  <span className="mt-0.5 text-[10px] text-gray-500">
                    Seleccionado: {form.proveedor_cliente_nombre}
                  </span>
                )}
              </div>

              {/* Centro de costo */}
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  Centro de costo
                </label>
                <input
                  type="text"
                  name="centro_costo_search"
                  list="centroscosto-list"
                  value={form.centro_costo_search}
                  onChange={handleCentroCostoInputChange}
                  className={baseInputClass}
                  placeholder="Escriba el nombre del CC"
                />
                <datalist id="centroscosto-list">
                  {centrosCosto.map((cc) => (
                    <option key={cc.id} value={cc.nombre} />
                  ))}
                </datalist>
                {form.centro_costo_nombre && (
                  <span className="mt-0.5 text-[10px] text-gray-500">
                    Seleccionado: {form.centro_costo_nombre}
                  </span>
                )}
              </div>

              {/* Proyecto */}
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Proyecto</label>
                <div className="relative">
                  <select
                    name="proyecto_id"
                    value={form.proyecto_id}
                    onChange={handleProyectoChange}
                    className={baseSelectClass}
                  >
                    <option value="">Sin proyecto</option>
                    {catalogos.proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre || p.descripcion || p.codigo || p.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </div>
                {form.proyecto_nombre && (
                  <span className="mt-0.5 text-[10px] text-gray-500">
                    {form.proyecto_nombre}
                  </span>
                )}
              </div>
            </div>

            {/* OC / Notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">
                  N° Orden relacionada
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="oc_numero"
                    value={form.oc_numero}
                    onChange={handleChangeForm}
                    className={baseInputClass + " flex-1"}
                    placeholder="MM-000123, etc."
                  />
                  <button
                    type="button"
                    onClick={handleBuscarOc}
                    className="px-2 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-gray-700"
                    disabled={buscandoOc}
                  >
                    {buscandoOc ? "Buscando..." : "Buscar"}
                  </button>
                </div>
                {ocError && (
                  <span className="mt-0.5 text-[10px] text-red-600">
                    {ocError}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Notas</label>
                <input
                  type="text"
                  name="notas"
                  value={form.notas}
                  onChange={handleChangeForm}
                  className={baseInputClass}
                />
              </div>
            </div>

            {/* Adjunto */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">
                Comprobante (opcional)
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="text-xs text-gray-700"
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cerrarModal}
                className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm text-gray-700 border border-gray-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-medium text-white disabled:opacity-60 shadow-sm"
              >
                {guardando
                  ? "Guardando..."
                  : form.id
                  ? "Guardar cambios"
                  : "Crear transacción"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// UI helpers
function Th({ children, className = "" }) {
  return (
    <th
      className={
        "px-2 py-2 text-left text-xs font-medium text-gray-600 " + className
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={
        "px-2 py-1.5 align-middle text-xs text-gray-800 " + className
      }
    >
      {children}
    </td>
  );
}

function ResumenCard({ titulo, valor, resaltado }) {
  let color = "text-gray-800";
  if (resaltado) {
    color =
      valor > 0
        ? "text-emerald-600"
        : valor < 0
        ? "text-red-600"
        : "text-gray-800";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className={"mt-1 text-lg sm:text-xl font-semibold " + color}>
        {valor.toLocaleString("es-PE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="bg-white border border-gray-300 rounded-xl shadow-xl w-full max-w-4xl mx-2 p-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// Ícono minimalista para los selects
function ChevronDownIcon() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">
      ▼
    </span>
  );
}

export default FlujosFinancieros;
