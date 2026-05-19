// src/components/TransaccionFormModal.jsx
// Extraído de FlujosFinancieros.jsx — modal de crear/editar transacción financiera.
import React, { useMemo, useState } from "react";
import {
  crearTransaccionFinanciera,
  actualizarTransaccionFinanciera,
  subirAdjuntoFinanzas,
  TIPO_TRANSACCION,
  CLASIFICACION_TRANSACCION,
  buscarOrdenesCompraPorNumero,
} from "../firebase/finanzasHelpers";

const METODOS_PAGO_OPCIONES = ["Transferencia", "CIPRL", "Efectivo", "Cheque", "Detracción", "Retención"];

// ── Estado inicial del formulario ────────────────────────────────
export function initialFormState(usuario) {
  return {
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
    proveedor_cliente_id: "",
    proveedor_cliente_nombre: "",
    proveedorSearch: "",
    centro_costo_id: "",
    centro_costo_nombre: "",
    centro_costo_search: "",
    proyecto_id: "",
    proyecto_nombre: "",
    documento_tipo: "",
    documento_numero: "",
    oc_id: "",
    oc_numero: "",
    facturaId: "",
    estado: "",
    fecha: new Date().toISOString().slice(0, 10),
    programado_fecha: "",
    notas: "",
    adjuntoFile: null,
    creadoPor: usuario?.nombreCompleto || usuario?.email || "",
    creadoPorUid: usuario?.uid || "",
    mesVencimiento: "",
    montoPresupuestado: "",
    postergado: false,
    detraccion: "",
    retencion: "",
    metodoPago: "",
    codigoItem: "",
    cantidad: "",
    precioUnitario: "",
    diasCredito: "",
    fechaInicio: "",
  };
}

// ── Componente principal ─────────────────────────────────────────
export default function TransaccionFormModal({
  initialData,        // null = nuevo, obj = editar
  usuario,
  catalogos,
  proveedorOptions,
  centroCostoOptions,
  areaTab,
  areaDefault,
  onClose,
  onSaved,            // callback tras guardar exitosamente
}) {
  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        ...initialFormState(usuario),
        ...initialData,
        fecha: initialData.fechaISO || initialData.fecha || new Date().toISOString().slice(0, 10),
        programado_fecha: initialData.programado_fechaISO || "",
        id: initialData.id,
        adjuntoFile: null,
        proveedorSearch:
          initialData.proveedor_cliente_nombre || initialData.proveedor_cliente_id || "",
        centro_costo_search: initialData.centro_costo_nombre || "",
      };
    }
    return initialFormState(usuario);
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [buscandoOc, setBuscandoOc] = useState(false);
  const [ocError, setOcError] = useState("");

  // ── Handlers genéricos ──────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setForm((prev) => ({ ...prev, adjuntoFile: e.target.files?.[0] || null }));
  };

  // ── Proveedor ───────────────────────────────────────────────
  const handleProveedorInput = (e) => {
    setForm((prev) => ({ ...prev, proveedorSearch: e.target.value }));
  };

  const handleProveedorSelect = (opt) => {
    const p = opt?.raw;
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      proveedorSearch: `${p.razonSocial} - ${p.ruc}`,
      proveedor_cliente_id: p.ruc,
      proveedor_cliente_nombre: p.razonSocial,
    }));
  };

  // ── Centro de costo ─────────────────────────────────────────
  const handleCCInput = (e) => {
    setForm((prev) => ({ ...prev, centro_costo_search: e.target.value }));
  };

  const handleCCSelect = (opt) => {
    const c = opt?.raw;
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      centro_costo_search: c.nombre,
      centro_costo_id: c.id,
      centro_costo_nombre: c.nombre,
    }));
  };

  // ── Proyecto ────────────────────────────────────────────────
  const handleProyectoChange = (e) => {
    const value = e.target.value;
    const p = catalogos.proyectos.find((proy) => proy.id === value);
    setForm((prev) => ({
      ...prev,
      proyecto_id: value || "",
      proyecto_nombre: p?.nombre || "",
    }));
  };

  // ── Buscar OC ───────────────────────────────────────────────
  const handleBuscarOc = async () => {
    setOcError("");
    if (!form.oc_numero) {
      setOcError("Ingrese el número de orden para buscar.");
      return;
    }
    setBuscandoOc(true);
    try {
      const resultados = await buscarOrdenesCompraPorNumero(form.oc_numero.trim());
      if (!resultados || resultados.length === 0) {
        setOcError("No se encontró ninguna orden con ese número.");
        return;
      }
      const oc = resultados[0];
      setForm((prev) => ({
        ...prev,
        oc_id: oc.id,
        oc_numero: oc.numero || oc.oc_numero || prev.oc_numero,
        proveedor_cliente_id: oc.proveedorRuc || prev.proveedor_cliente_id,
        proveedor_cliente_nombre: oc.proveedorNombre || prev.proveedor_cliente_nombre,
        proveedorSearch:
          oc.proveedorNombre && oc.proveedorRuc
            ? `${oc.proveedorNombre} - ${oc.proveedorRuc}`
            : prev.proveedorSearch,
        centro_costo_id: oc.centroCostoId || prev.centro_costo_id,
        centro_costo_nombre: oc.centroCostoNombre || prev.centro_costo_nombre,
        centro_costo_search: oc.centroCostoNombre || prev.centro_costo_search,
        proyecto_id: oc.proyectoId || prev.proyecto_id,
        proyecto_nombre: oc.proyectoNombre || prev.proyecto_nombre,
        moneda: oc.moneda || prev.moneda,
      }));
    } catch (e) {
      console.error(e);
      setOcError("Error buscando la orden.");
    } finally {
      setBuscandoOc(false);
    }
  };

  // ── IGV resolver ────────────────────────────────────────────
  const resolverIgvCodigo = () => {
    const sub = catalogos.subcategorias.find((s) => s.id === form.subcategoriaId);
    if (sub?.igvCodigoDefault) return sub.igvCodigoDefault;
    const cat = catalogos.categorias.find((c) => c.id === form.categoriaId);
    if (cat?.igvCodigoDefault) return cat.igvCodigoDefault;
    return form.igvCodigo || "";
  };

  // ── Alerta tipo vs categoría ─────────────────────────────────
  const catNombre = useMemo(() => {
    const cat = catalogos.categorias.find((c) => c.id === form.categoriaId);
    return (cat?.nombre || cat?.descripcion || "").toLowerCase();
  }, [catalogos.categorias, form.categoriaId]);

  const alertaTipoCategoria = useMemo(() => {
    if (!catNombre || !form.tipo) return null;
    const esIngresoCat = catNombre.includes("ingreso");
    const esEgresoCat = catNombre.includes("egreso") || catNombre.includes("gasto");
    if (esIngresoCat && form.tipo === "EGRESO")
      return "La categoria indica INGRESOS pero el tipo esta marcado como EGRESO. Verifique.";
    if (esEgresoCat && form.tipo === "INGRESO")
      return "La categoria indica EGRESOS/GASTOS pero el tipo esta marcado como INGRESO. Verifique.";
    return null;
  }, [catNombre, form.tipo]);

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuario) return;

    // Validar montos no negativos
    const montoBase = Number(form.monto_sin_igv || 0);
    if (montoBase < 0) {
      setError("El monto no puede ser negativo. Use el campo Tipo (INGRESO/EGRESO) para indicar la direccion del flujo.");
      return;
    }

    setGuardando(true);
    setError("");

    try {
      const igvCodigo = resolverIgvCodigo();
      const cat = catalogos.categorias.find((c) => c.id === form.categoriaId);
      const sub = catalogos.subcategorias.find((s) => s.id === form.subcategoriaId);
      const estadoObj = catalogos.estados.find((s) => s.nombre === form.estado);

      const payloadBase = {
        tipo: form.tipo,
        clasificacion: form.clasificacion,
        categoriaId: form.categoriaId || null,
        categoriaNombre: cat?.nombre || cat?.descripcion || cat?.codigo || "",
        subcategoriaId: form.subcategoriaId || null,
        subcategoriaNombre: sub?.nombre || sub?.descripcion || sub?.codigo || "",
        moneda: form.moneda,
        tc: form.tc ? Number(form.tc) : null,
        monto_sin_igv: form.monto_sin_igv ? Number(form.monto_sin_igv) : 0,
        igvCodigo: igvCodigo || null,
        forma_pago: form.forma_pago || "",
        proveedor_cliente_id: form.proveedor_cliente_id || null,
        proveedor_cliente_nombre: form.proveedor_cliente_nombre || form.proveedorSearch || "",
        centro_costo_id: form.centro_costo_id || null,
        centro_costo_nombre: form.centro_costo_nombre || form.centro_costo_search || "",
        proyecto_id: form.proyecto_id || null,
        proyecto_nombre: form.proyecto_nombre || "",
        documento_tipo: form.documento_tipo || "",
        documento_numero: form.documento_numero || "",
        oc_id: form.oc_id || null,
        oc_numero: form.oc_numero || "",
        facturaId: form.facturaId || null,
        estado: estadoObj?.nombre || form.estado || "",
        fecha: form.fecha ? new Date(form.fecha) : new Date(),
        programado_fecha: form.programado_fecha ? new Date(form.programado_fecha) : null,
        notas: form.notas || "",
        creadoPor: form.creadoPor || usuario?.nombreCompleto || usuario?.email || "",
        creadoPorUid: form.creadoPorUid || usuario?.uid || "",
        area: areaTab === "consolidado" ? (areaDefault || "ti") : areaTab,
        mesVencimiento: form.mesVencimiento || null,
        montoPresupuestado: form.montoPresupuestado ? Number(form.montoPresupuestado) : null,
        postergado: Boolean(form.postergado),
        detraccion: form.detraccion ? Number(form.detraccion) : null,
        retencion: form.retencion ? Number(form.retencion) : null,
        metodoPago: form.metodoPago || "",
        ...(areaTab === "operaciones" && {
          codigoItem: form.codigoItem || "",
          cantidad: form.cantidad ? Number(form.cantidad) : null,
          precioUnitario: form.precioUnitario ? Number(form.precioUnitario) : null,
          diasCredito: form.diasCredito ? Number(form.diasCredito) : null,
          fechaInicio: form.fechaInicio || "",
        }),
      };

      let idTransaccion = form.id || null;

      if (!idTransaccion) {
        idTransaccion = await crearTransaccionFinanciera({ ...payloadBase, igvCodigo });
      } else {
        await actualizarTransaccionFinanciera(idTransaccion, { ...payloadBase, igvCodigo });
      }

      if (form.adjuntoFile && idTransaccion) {
        const adj = await subirAdjuntoFinanzas(form.adjuntoFile, idTransaccion);
        await actualizarTransaccionFinanciera(idTransaccion, { adjuntos: [adj] });
      }

      onSaved?.();
    } catch (e) {
      console.error(e);
      setError("Error guardando la transacción financiera.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
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

        <form onSubmit={handleSubmit} className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
          <h2 className="text-lg font-semibold mb-1 text-gray-800">
            {form.id ? "Editar transaccion" : "Nueva transaccion"}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {alertaTipoCategoria && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 rounded text-sm flex items-center gap-2">
              <span className="text-lg">⚠</span>
              <span>{alertaTipoCategoria}</span>
            </div>
          )}

          {/* Tipo / clasif / estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormSelect label="Tipo" name="tipo" value={form.tipo} onChange={handleChange}
              options={[
                { value: TIPO_TRANSACCION.INGRESO, label: "INGRESO" },
                { value: TIPO_TRANSACCION.EGRESO,  label: "EGRESO" },
              ]}
            />
            <FormSelect label="Clasificacion" name="clasificacion" value={form.clasificacion} onChange={handleChange}
              options={[
                { value: CLASIFICACION_TRANSACCION.OPEX, label: "OPEX" },
                { value: CLASIFICACION_TRANSACCION.CAPEX, label: "CAPEX" },
              ]}
            />
            <FormSelect label="Estado" name="estado" value={form.estado} onChange={handleChange}
              placeholder="Seleccione..."
              options={catalogos.estados.map((e) => ({
                value: e.nombre || e.descripcion,
                label: e.nombre || e.descripcion || e.codigo || e.id,
              }))}
            />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormInput label="Fecha" type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
            <FormInput label="Fecha programada (pago)" type="date" name="programado_fecha" value={form.programado_fecha} onChange={handleChange} />
          </div>

          {/* Categorias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormSelect label="Categoria" name="categoriaId" value={form.categoriaId} onChange={handleChange}
              placeholder="Seleccione..."
              options={catalogos.categorias.map((c) => ({
                value: c.id,
                label: c.nombre || c.descripcion || c.codigo || c.id,
              }))}
            />
            <FormSelect label="Subcategoria" name="subcategoriaId" value={form.subcategoriaId} onChange={handleChange}
              placeholder="Seleccione..."
              options={catalogos.subcategorias
                .filter((s) => !form.categoriaId || s.categoriaId === form.categoriaId)
                .map((s) => ({
                  value: s.id,
                  label: s.nombre || s.descripcion || s.codigo || s.id,
                }))}
            />
          </div>

          {/* Montos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormSelect label="Moneda" name="moneda" value={form.moneda} onChange={handleChange}
              options={[{ value: "PEN", label: "PEN" }, { value: "USD", label: "USD" }]}
            />
            <FormInput label="TC (si no es PEN)" type="number" step="0.0001" name="tc" value={form.tc} onChange={handleChange} placeholder="Opcional si PEN" />
            <FormInput label="Monto sin IGV" type="number" step="0.01" name="monto_sin_igv" value={form.monto_sin_igv} onChange={handleChange} required />
          </div>

          {/* Forma de pago / doc */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormSelect label="Forma de pago" name="forma_pago" value={form.forma_pago} onChange={handleChange}
              placeholder="Seleccione..."
              options={catalogos.formasPago.map((f) => ({
                value: f.nombre || f.codigo,
                label: f.nombre || f.descripcion || f.codigo || f.id,
              }))}
            />
            <FormSelect label="Tipo de documento" name="documento_tipo" value={form.documento_tipo} onChange={handleChange}
              placeholder="Seleccione..."
              options={catalogos.tiposDocumento.map((td) => ({
                value: td.nombre,
                label: td.nombre || td.descripcion || td.codigo || td.id,
              }))}
            />
            <FormInput label="N° documento" type="text" name="documento_numero" value={form.documento_numero} onChange={handleChange} placeholder="F001-000123" />
          </div>

          {/* Proveedor / CC / Proyecto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SearchSelect
              label="Proveedor / Cliente"
              placeholder="Buscar por razon social o RUC"
              value={form.proveedorSearch}
              onInputChange={handleProveedorInput}
              options={proveedorOptions}
              onSelect={handleProveedorSelect}
              helperText={form.proveedor_cliente_nombre ? `Seleccionado: ${form.proveedor_cliente_nombre}` : ""}
            />
            <SearchSelect
              label="Centro de costo"
              placeholder="Buscar centro de costo"
              value={form.centro_costo_search}
              onInputChange={handleCCInput}
              options={centroCostoOptions}
              onSelect={handleCCSelect}
              helperText={form.centro_costo_nombre ? `Seleccionado: ${form.centro_costo_nombre}` : ""}
            />
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Proyecto</label>
              <select name="proyecto_id" value={form.proyecto_id} onChange={handleProyectoChange}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Sin proyecto</option>
                {catalogos.proyectos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre || p.descripcion || p.codigo || p.id}</option>
                ))}
              </select>
              {form.proyecto_nombre && (
                <span className="mt-0.5 text-[10px] text-gray-500">{form.proyecto_nombre}</span>
              )}
            </div>
          </div>

          {/* OC / Notas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">N° Orden relacionada</label>
              <div className="flex gap-2">
                <input type="text" name="oc_numero" value={form.oc_numero} onChange={handleChange}
                  className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="MM-000123, etc." />
                <button type="button" onClick={handleBuscarOc} disabled={buscandoOc}
                  className="px-2 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-700">
                  {buscandoOc ? "Buscando..." : "Buscar"}
                </button>
              </div>
              {ocError && <span className="mt-0.5 text-[10px] text-red-600">{ocError}</span>}
            </div>
            <FormInput label="Notas" type="text" name="notas" value={form.notas} onChange={handleChange} />
          </div>

          {/* Campos Operaciones */}
          {(areaTab === "operaciones" || form.area === "operaciones") && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
              <p className="col-span-full text-xs font-semibold text-purple-700 mb-0">Datos de Operaciones</p>
              <FormInput label="Codigo item" type="text" name="codigoItem" value={form.codigoItem} onChange={handleChange} ring="purple" />
              <FormInput label="Cantidad" type="number" step="1" name="cantidad" value={form.cantidad} onChange={handleChange} ring="purple" />
              <FormInput label="Precio unitario" type="number" step="0.01" name="precioUnitario" value={form.precioUnitario} onChange={handleChange} ring="purple" />
              <FormInput label="Dias credito" type="number" step="1" name="diasCredito" value={form.diasCredito} onChange={handleChange} ring="purple" />
              <FormInput label="Fecha inicio" type="date" name="fechaInicio" value={form.fechaInicio} onChange={handleChange} ring="purple" />
            </div>
          )}

          {/* Campos extendidos comunes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
            <p className="col-span-full text-xs font-semibold text-gray-500 mb-0">Datos adicionales</p>
            <FormSelect label="Metodo de pago" name="metodoPago" value={form.metodoPago} onChange={handleChange}
              placeholder="Seleccione..."
              options={METODOS_PAGO_OPCIONES.map((m) => ({ value: m, label: m }))}
            />
            <FormInput label="Mes vencimiento" type="month" name="mesVencimiento" value={form.mesVencimiento} onChange={handleChange} />
            <FormInput label="Detraccion (S/)" type="number" step="0.01" name="detraccion" value={form.detraccion} onChange={handleChange} placeholder="0.00" />
            <FormInput label="Retencion (S/)" type="number" step="0.01" name="retencion" value={form.retencion} onChange={handleChange} placeholder="0.00" />
            <FormInput label="Monto presupuestado" type="number" step="0.01" name="montoPresupuestado" value={form.montoPresupuestado} onChange={handleChange} placeholder="0.00" />
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="postergado" name="postergado" checked={Boolean(form.postergado)}
                onChange={(e) => setForm((p) => ({ ...p, postergado: e.target.checked }))}
                className="accent-amber-500" />
              <label htmlFor="postergado" className="text-xs text-gray-700 cursor-pointer">Postergado</label>
            </div>
          </div>

          {/* Adjunto */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Comprobante (opcional)</label>
            <input type="file" onChange={handleFileChange} className="text-xs text-gray-700" />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm text-gray-700 border border-gray-300">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="px-3 py-1.5 rounded-lg bg-[#f0c000] hover:bg-[#d4a800] text-xs sm:text-sm font-semibold text-black disabled:opacity-60 transition-colors">
              {guardando ? "Guardando..." : form.id ? "Guardar cambios" : "Crear transaccion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componentes auxiliares reutilizables ──────────────────────────
function FormInput({ label, ring = "blue", ...props }) {
  return (
    <div className="flex flex-col">
      {label && <label className="text-xs text-gray-600 mb-1">{label}</label>}
      <input
        {...props}
        className={`bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-${ring}-500`}
      />
    </div>
  );
}

function FormSelect({ label, options, placeholder, ring = "blue", ...props }) {
  return (
    <div className="flex flex-col">
      {label && <label className="text-xs text-gray-600 mb-1">{label}</label>}
      <select
        {...props}
        className={`bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-${ring}-500`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SearchSelect({ label, placeholder, value, onInputChange, options, onSelect, helperText }) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = (value || "").toLowerCase().trim();
    if (!term) return options.slice(0, 40);
    return options
      .filter((o) => {
        const l = (o.label || "").toLowerCase();
        const s = (o.subLabel || "").toLowerCase();
        return l.includes(term) || s.includes(term);
      })
      .slice(0, 40);
  }, [options, value]);

  const handleBlur = () => setTimeout(() => setOpen(false), 120);

  return (
    <div className="relative flex flex-col">
      {label && <label className="text-xs text-gray-600 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text" value={value} onChange={onInputChange}
          onFocus={() => setOpen(true)} onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full bg-white border border-gray-300 rounded px-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-400">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
            <path d="M9 3.5A5.5 5.5 0 1 1 3.5 9 5.5 5.5 0 0 1 9 3.5Zm0-1.5A7 7 0 1 0 16 9a7 7 0 0 0-7-7Z" fill="currentColor" />
            <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-xs sm:text-sm z-40">
          {filtered.map((opt) => (
            <button type="button" key={opt.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect?.(opt); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 focus:bg-blue-50">
              <div className="font-medium text-gray-800">{opt.label}</div>
              {opt.subLabel && <div className="text-[11px] text-gray-500">{opt.subLabel}</div>}
            </button>
          ))}
        </div>
      )}

      {helperText && <span className="mt-0.5 text-[10px] text-gray-500">{helperText}</span>}
    </div>
  );
}
