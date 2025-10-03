// ✅ src/pages/VerOC.jsx (stable hooks + guards)
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { obtenerOCporId } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";
import { ocPendingForRole } from "../utils/aprobaciones";

// Detecta cuenta de detracción en bancos
const findDetraccion = (bancos = []) => {
  if (!Array.isArray(bancos)) return null;
  const up = (s = "") => s.toUpperCase();
  return (
    bancos.find(
      (b) =>
        up(b?.nombre).includes("DETRACC") ||
        up(b?.nombre) === "BN" ||
        up(b?.nombre).includes("BANCO DE LA NACION")
    ) || null
  );
};

// Compat firmas (soporta {firmaX} plano y oc.firmas.{x})
const pickFirma = (oc, plano, obj) => oc?.[plano] || oc?.firmas?.[obj] || null;

const VerOC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");
  const stateOC = location.state?.orden;

  const { usuario, loading } = useUsuario();
  const [oc, setOC] = useState(null);

  // Cargar OC (si no llegó por state)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (stateOC) {
        if (alive) setOC(stateOC);
        return;
      }
      if (ocId) {
        const encontrada = await obtenerOCporId(ocId);
        if (alive) setOC(encontrada || null);
      }
    })();
    return () => { alive = false; };
  }, [ocId, stateOC]);

  // ====== Datos derivados SIEMPRE (sin condicionales de hooks) ======
  // Asegura que items sea siempre array (para OS puede venir vacío)
  const items = useMemo(() => (Array.isArray(oc?.items) ? oc.items : []), [oc?.items]);

  // Moneda (texto de formatearMoneda ya maneja ambos)
  const simbolo = useMemo(
    () => (oc?.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles"),
    [oc?.monedaSeleccionada]
  );

  // Cálculo consistente con CrearOC.jsx:
  // sum(cant*PU - dscto) = subtotal; igv = 18% del subtotal; total = subtotal + igv
  const { subtotal, igv, total } = useMemo(() => {
    const sub = items.reduce(
      (acc, it) =>
        acc +
        (Number(it.cantidad || 0) * Number(it.precioUnitario || 0) -
          Number(it.descuento || 0)),
      0
    );
    const igvCalc = Math.round(sub * 0.18 * 100) / 100;
    const totalCalc = Math.round((sub + igvCalc) * 100) / 100;
    return { subtotal: sub, igv: igvCalc, total: totalCalc };
  }, [items]);

  const detraccionCuenta = useMemo(
    () => oc?.detraccion || findDetraccion(oc?.proveedor?.bancos),
    [oc?.detraccion, oc?.proveedor?.bancos]
  );

  const puedeExportar = useMemo(() => oc?.estado === "Aprobado", [oc?.estado]);
  const puedeFirmar = useMemo(
    () => (!!usuario && oc ? ocPendingForRole(oc, usuario.rol, usuario.email) : false),
    [oc, usuario]
  );

  // Firmas (3 bloques)
  const firmaOperaciones = useMemo(() => pickFirma(oc || {}, "firmaOperaciones", "operaciones"), [oc]);
  const firmaGerOp = useMemo(() => pickFirma(oc || {}, "firmaGerenciaOperaciones", "gerenciaOperaciones"), [oc]);
  const firmaGerGral = useMemo(() => pickFirma(oc || {}, "firmaGerenciaGeneral", "gerenciaGeneral"), [oc]);

  const exportarPDF = () => {
    const el = document.getElementById("contenido-oc");
    if (!el) return;
    const manyItems = (items.length || 0) > 18;
    const jsPDF = { unit: "in", format: "a4", orientation: manyItems ? "landscape" : "portrait" };
    html2pdf()
      .set({
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `OC-${oc?.numeroOC || oc?.id || "orden"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 3, scrollY: 0, useCORS: true },
        jsPDF,
        pagebreak: { mode: ["avoid-all"] },
      })
      .from(el)
      .save();
  };

  // ====== Renders estáticos/tempranos (sin nuevos hooks debajo) ======
  if (loading) return <div className="p-6">Cargando usuario...</div>;
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;
  if (oc === null) return <div className="p-6">Cargando orden...</div>;
  if (!oc) return <div className="p-6">No se encontró la orden.</div>;

  return (
    <div className="p-4 md:p-6">
      <div
        id="contenido-oc"
        className="text-xs leading-tight max-w-[794px] mx-auto p-4 bg-white text-black"
        style={{ fontSize: "10px", fontFamily: "Arial, sans-serif" }}
      >
        {/* ENCABEZADO */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-4">
            <img src={Logo} alt="Logo Memphis" className="h-14" />
            <div className="text-[10px] leading-tight">
              <p className="font-bold text-[#004990]">Memphis Maquinarias S.A.C</p>
              <p>RUC: 20603847424</p>
              <p>AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima</p>
              <p>Teléfono: (01) 7174012</p>
              <p>www.memphismaquinarias.com</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold text-[#004990]">ORDEN</h1>
            <p className="text-sm font-semibold text-blue-800">
              N° {oc.numeroOC || oc.id}
            </p>
          </div>
        </div>

        {/* DATOS GENERALES */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DATOS GENERALES</h3>
        <div className="grid grid-cols-2 gap-3 mb-3 border p-3 rounded">
          <div><strong>Fecha de Emisión:</strong> {oc.fechaEmision || "—"}</div>
          {oc.requerimiento && <div><strong>N° Requerimiento:</strong> {oc.requerimiento}</div>}
          <div><strong>N° Cotización:</strong> {oc.cotizacion || "—"}</div>
          <div><strong>Centro de Costo:</strong> {oc.centroCosto || "—"}</div>
        </div>

        {/* PROVEEDOR */}
        {oc.tipoOrden !== "OI" && (
          <>
            <h3 className="text-sm font-semibold mb-1 text-blue-900">PROVEEDOR</h3>
            <div className="grid grid-cols-2 gap-3 mb-4 border p-3 rounded">
              <div><strong>Proveedor:</strong> {oc.proveedor?.razonSocial || "—"}</div>
              <div><strong>RUC:</strong> {oc.proveedor?.ruc || "—"}</div>
              <div><strong>Dirección:</strong> {oc.proveedor?.direccion || "—"}</div>
              <div><strong>Contacto:</strong> {oc.proveedor?.contacto || "—"}</div>
              <div><strong>Teléfono:</strong> {oc.proveedor?.telefono || "—"}</div>
              <div><strong>Correo:</strong> {oc.proveedor?.email || "—"}</div>
              <div><strong>Banco:</strong> {oc.bancoSeleccionado || "—"}</div>
              <div><strong>Moneda:</strong> {oc.monedaSeleccionada || simbolo}</div>
              <div><strong>Cuenta:</strong> {oc.cuenta?.cuenta || "—"}</div>
              <div><strong>CCI:</strong> {oc.cuenta?.cci || "—"}</div>

              {detraccionCuenta && (
                <>
                  <div className="col-span-2 mt-2 pt-2 border-t">
                    <span className="text-red-700 font-semibold">Cuenta de Detracciones (BN)</span>
                  </div>
                  <div><strong>Cuenta:</strong> {detraccionCuenta.cuenta || "—"}</div>
                  <div><strong>CCI:</strong> {detraccionCuenta.cci || "—"}</div>
                </>
              )}
            </div>
          </>
        )}

        {/* DETALLE */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DETALLE</h3>
        <table className="w-full text-[9px] border border-collapse mb-3" style={{ borderSpacing: "0" }}>
          <thead className="bg-gray-200 text-[9px]">
            <tr>
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Descripción</th>
              <th className="border px-2 py-1">Cantidad</th>
              <th className="border px-2 py-1">U.M.</th>
              <th className="border px-2 py-1">P. Unit</th>
              <th className="border px-2 py-1">Descuento</th>
              <th className="border px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const cantidad = Number(it.cantidad || 0);
              const pu = Number(it.precioUnitario || 0);
              const dscto = Number(it.descuento || 0);
              const totalItem = cantidad * pu - dscto;
              return (
                <tr key={i} className="text-center">
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{it.nombre || it.descripcion || "—"}</td>
                  <td className="border px-2 py-1">{cantidad}</td>
                  <td className="border px-2 py-1">{it.unidad || "UND"}</td>
                  <td className="border px-2 py-1">{formatearMoneda(pu, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(dscto, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(totalItem, simbolo)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-3">Sin ítems.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* TOTALES */}
        <h3 className="text-right text-sm font-semibold mb-1 text-blue-900">RESUMEN</h3>
        <div className="text-right mb-4 pr-2 space-y-0.5">
          <p><strong>Subtotal:</strong> {formatearMoneda(subtotal, simbolo)}</p>
          <p><strong>IGV (18%):</strong> {formatearMoneda(igv, simbolo)}</p>
          <p className="text-sm font-bold mt-1">
            <strong>Total:</strong> {formatearMoneda(total, simbolo)}
          </p>
        </div>

        {/* FIRMAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mt-12 text-[11px] font-sans">
          {[
            { rol: "Operaciones", src: firmaOperaciones },
            { rol: "Gerencia Operaciones", src: firmaGerOp },
            { rol: "Gerencia General", src: firmaGerGral },
          ].map(({ rol, src }) => (
            <div key={rol} className="flex flex-col items-center justify-end">
              {src ? (
                <img src={src} alt={`Firma ${rol}`} className="h-20 object-contain mb-2" />
              ) : (
                <div className="h-20 mb-2"></div>
              )}
              <p className="font-semibold">{rol}</p>
            </div>
          ))}
        </div>

        {/* PIE */}
        <div className="mt-4 text-[8px] leading-snug text-gray-700 border-t pt-2">
          <p className="mb-1 font-semibold">ENVIAR SU COMPROBANTE CON COPIA A:</p>
          <ul className="list-disc pl-4">
            <li>
              FACTURAS ELECTRÓNICAS: lmeneses@memphis.pe | dmendez@memphis.pe | facturacion@memphis.pe | gomontero@memphis.pe | mcastaneda@memphis.pe | mchuman@memphis.pe
            </li>
            <li>CONSULTA DE PAGOS: lmeneses@memphis.pe | dmendez@memphis.pe</li>
          </ul>
          <p className="mt-1 text-justify italic">
            El presente servicio o producto cumple con los lineamientos de nuestro Sistema de Gestión Antisoborno.
          </p>
        </div>
      </div>

      {/* ACCIONES */}
      <div className="mt-4 flex gap-4">
        {puedeFirmar && (
          <button
            onClick={() => navigate(`/firmar?id=${oc.id}`)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Aprobar / Rechazar OC
          </button>
        )}
        {puedeExportar && (
          <button
            onClick={exportarPDF}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Exportar como PDF
          </button>
        )}
      </div>
    </div>
  );
};

export default VerOC;
