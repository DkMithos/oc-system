// ✅ src/pages/EditarOC.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ItemTable from "../components/ItemTable";
import {
  obtenerOCporId,
  actualizarOC,
  obtenerCondicionesPago,
  obtenerCentrosCosto,
  obtenerProveedores,
} from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/logo-navbar.png";
import Select from "react-select";
import { useUsuario } from "../context/UsuarioContext";

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 36,
    borderColor: "#d1d5db",
    boxShadow: "none",
    ":hover": { borderColor: "#9ca3af" },
    fontSize: 14,
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 32 }),
  menu: (base) => ({ ...base, zIndex: 30, fontSize: 14 }),
};

const EditarOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, loading } = useUsuario();

  const ocId = new URLSearchParams(location.search).get("id");

  const [formData, setFormData] = useState(null);
  const [items, setItems] = useState([]);
  const [otros, setOtros] = useState(0);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [condicionesPago, setCondicionesPago] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    const cargar = async () => {
      const oc = await obtenerOCporId(ocId);
      if (!oc || oc.estado !== "Rechazado") {
        alert("Esta orden no puede ser editada.");
        navigate("/");
        return;
      }
      if (!usuario || !["comprador", "admin"].includes(usuario.rol)) {
        alert("No tienes permiso para editar esta orden.");
        navigate("/");
        return;
      }

      setFormData({
        ...oc,
        notas: oc.notas || oc.observaciones || "", // 👈 compat
      });
      setItems(oc.items || []);
      setOtros(Number(oc.resumen?.otros || 0));

      const [centros, condiciones, listaProveedores] = await Promise.all([
        obtenerCentrosCosto(),
        obtenerCondicionesPago(),
        obtenerProveedores(),
      ]);

      setCentrosCosto(centros.map((c) => c.nombre));
      setCondicionesPago(condiciones.map((c) => c.nombre));
      setProveedores(listaProveedores);
    };

    if (!loading) cargar();
  }, [ocId, navigate, usuario, loading]);

  if (!formData || loading) return <div className="p-6">Cargando orden...</div>;

  const bancosDisponibles = formData.proveedor?.bancos || [];
  const monedasDisponibles = bancosDisponibles
    .filter((b) => b.nombre === formData.bancoSeleccionado)
    .map((b) => b.moneda);

  const cuentaSeleccionada = bancosDisponibles.find(
    (b) =>
      b.nombre === formData.bancoSeleccionado &&
      b.moneda === formData.monedaSeleccionada
  );

  const subtotal = items.reduce(
    (acc, item) =>
      acc +
      (Number(item.precioUnitario) - Number(item.descuento || 0)) *
        Number(item.cantidad || 0),
    0
  );
  const igv = subtotal * 0.18;
  const totalFinal = subtotal + igv + Number(otros || 0);

  const validarFormulario = () => {
    if (
      !formData.fechaEmision ||
      !formData.fechaEntrega ||
      !formData.comprador ||
      !formData.proveedor?.ruc
    ) {
      alert("Completa todos los campos obligatorios.");
      return false;
    }
    const tieneItemsValidos = items.some(
      (item) => item.nombre && Number(item.cantidad) > 0
    );
    if (!tieneItemsValidos) {
      alert("Agrega al menos un ítem válido.");
      return false;
    }
    return true;
  };

  const handleActualizarOC = async () => {
    if (!validarFormulario()) return;

    const nuevaData = {
      ...formData,
      cuenta: cuentaSeleccionada || null,
      items,
      resumen: {
        subtotal,
        igv,
        valorVenta: subtotal,
        otros: parseFloat(otros) || 0,
        total: totalFinal,
      },
      // Reencola en el flujo
      estado: "Pendiente de Operaciones",
      // notas ya viene en formData.notas
      historial: [
        ...(formData.historial || []),
        {
          accion: "Edición y reenvío a Operaciones",
          por: usuario.email,
          fecha: new Date().toLocaleString("es-PE"),
        },
      ],
      // limpiar firmas
      firmaOperaciones: null,
      firmaGerenciaOperaciones: null,
      firmaGerenciaGeneral: null,
      firmas: { operaciones: null, gerenciaOperaciones: null, gerenciaGeneral: null },
    };

    try {
      await actualizarOC(formData.id, nuevaData);
      alert("Orden de compra actualizada ✅");
      navigate("/ver?id=" + formData.id);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la OC.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] px-6 py-4">
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4 items-start">
          <img src={Logo} alt="Logo Memphis" className="h-14" />
          <div className="text-xs leading-tight">
            <p className="font-bold text-[#004990]">Memphis Maquinarias S.A.C</p>
            <p>RUC: 20603847424</p>
            <p>AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima</p>
            <p>Teléfono: (01) 7174012</p>
            <p>www.memphismaquinarias.com</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#004990]">Editar OC</h2>
      </div>

      {/* Datos generales + proveedor */}
      <div className="bg-[#f4f4f4] p-6 rounded shadow mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <input type="date" disabled value={formData.fechaEmision} />
        <input
          type="text"
          placeholder="N° Cotización"
          value={formData.cotizacion || ""}
          onChange={(e) => setFormData({ ...formData, cotizacion: e.target.value })}
        />
        <input
          type="date"
          value={formData.fechaEntrega || ""}
          onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
        />
        <input type="text" disabled value={formData.comprador || ""} />

        <div className="col-span-2 md:col-span-3">
          <Select
            value={
              formData.proveedor?.ruc
                ? {
                    value: formData.proveedor.ruc,
                    label: `${formData.proveedor.ruc} - ${formData.proveedor.razonSocial}`,
                    data: formData.proveedor,
                  }
                : null
            }
            options={proveedores.map((p) => ({
              value: p.ruc,
              label: `${p.ruc} - ${p.razonSocial}`,
              data: p,
            }))}
            onChange={(op) =>
              setFormData((prev) => ({
                ...prev,
                proveedor: op?.data || {},
                bancoSeleccionado: "",
                monedaSeleccionada: "",
              }))
            }
            isSearchable
            placeholder="Selecciona proveedor"
            styles={selectStyles}
          />
        </div>

        <input disabled value={formData.proveedor?.razonSocial || ""} />
        <input disabled value={formData.proveedor?.direccion || ""} />
        <input disabled value={formData.proveedor?.email || ""} />
        <input disabled value={formData.proveedor?.telefono || ""} />
        <input disabled value={formData.proveedor?.contacto || ""} />

        <select
          value={formData.bancoSeleccionado || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              bancoSeleccionado: e.target.value,
              monedaSeleccionada: "",
            })
          }
        >
          <option value="">Selecciona banco</option>
          {bancosDisponibles.map((b, i) => (
            <option key={`${b.nombre}-${i}`} value={b.nombre}>
              {b.nombre}
            </option>
          ))}
        </select>

        <select
          value={formData.monedaSeleccionada || ""}
          onChange={(e) =>
            setFormData({ ...formData, monedaSeleccionada: e.target.value })
          }
        >
          <option value="">Selecciona moneda</option>
          {monedasDisponibles.map((m, i) => (
            <option key={`${m}-${i}`} value={m}>
              {m}
            </option>
          ))}
        </select>

        {cuentaSeleccionada && (
          <>
            <input disabled value={cuentaSeleccionada.cuenta || ""} />
            <input disabled value={cuentaSeleccionada.cci || ""} />
          </>
        )}

        <input
          type="text"
          placeholder="Lugar de Entrega"
          value={formData.lugarEntrega || ""}
          onChange={(e) =>
            setFormData({ ...formData, lugarEntrega: e.target.value })
          }
          className="col-span-2 md:col-span-3"
        />
      </div>

      <ItemTable items={items} setItems={setItems} moneda={formData.monedaSeleccionada} />

      {/* Centro de costo / Condición / Notas */}
      <div className="bg-[#f4f4f4] p-6 rounded shadow mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <select
          value={formData.centroCosto || ""}
          onChange={(e) => setFormData({ ...formData, centroCosto: e.target.value })}
        >
          <option value="">Centro de Costo</option>
          {centrosCosto.map((cc) => (
            <option key={cc} value={cc}>
              {cc}
            </option>
          ))}
        </select>

        <select
          value={formData.condicionPago || ""}
          onChange={(e) => setFormData({ ...formData, condicionPago: e.target.value })}
        >
          <option value="">Condición de Pago</option>
          {condicionesPago.map((cp) => (
            <option key={cp} value={cp}>
              {cp}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Notas (observaciones)"
          value={formData.notas || ""}      // 👈 ahora usa 'notas'
          onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
          className="col-span-2 md:col-span-3 border p-2 rounded"
        />
      </div>

      {/* Totales */}
      <div className="bg-white border shadow rounded p-6 w-full max-w-md mt-6">
        <p className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>{formatearMoneda(subtotal, formData.monedaSeleccionada)}</span>
        </p>
        <p className="flex justify-between text-sm">
          <span>IGV (18%):</span>
          <span>{formatearMoneda(igv, formData.monedaSeleccionada)}</span>
        </p>
        <p className="flex justify-between text-sm items-center">
          <span>Otros:</span>
          <input
            type="number"
            value={otros}
            onChange={(e) => setOtros(e.target.value)}
            className="border px-2 py-1 w-32 text-right rounded"
          />
        </p>
        <hr className="my-2" />
        <p className="flex justify-between font-bold text-base">
          <span>Total:</span>
          <span>{formatearMoneda(totalFinal, formData.monedaSeleccionada)}</span>
        </p>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={handleActualizarOC}
          className="bg-[#004990] text-white px-6 py-2 rounded hover:bg-[#003066] transition-all"
        >
          Actualizar Orden de Compra
        </button>
      </div>
    </div>
  );
};

export default EditarOC;
