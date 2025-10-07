// ✅ src/pages/VerOC.jsx (1 hoja, máx. 15 ítems, firmas, cuenta BN bajo PROVEEDOR)
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { obtenerOCporId } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";
import { ocPendingForRole } from "../utils/aprobaciones";

// === helpers ===
const up = (s = "") => s.toUpperCase();
const findDetraccion = (bancos = []) => {
  if (!Array.isArray(bancos)) return null;
  return (
    bancos.find(
      (b) =>
        up(b?.nombre).includes("DETRACC") ||
        up(b?.nombre) === "BN" ||
        up(b?.nombre).includes("BANCO DE LA NACION")
    ) || null
  );
};
const pickFirma = (oc, plano, obj) => oc?.[plano] || oc?.firmas?.[obj] || null;

const ITEMS_MAX = 15; // 👈 límite duro para 1 hoja

const VerOC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");
  const stateOC = location.state?.orden;

  const { usuario, loading } = useUsuario();
  const [oc, setOC] = useState(null);

  // Carga OC
  useEffect(() => {
    let alive = true;
    (async () => {
      if (stateOC) {
        if (alive) setOC(stateOC);
      } else if (ocId) {
        const encontrada = await obtenerOCporId(ocId);
        if (alive) setOC(encontrada || null);
      }
    })();
    return () => { alive = false; };
  }, [ocId, stateOC]);

  // Derivados
  const items = useMemo(() => (Array.isArray(oc?.items) ? oc.items : []), [oc?.items]);
  const itemsToShow = useMemo(() => items.slice(0, ITEMS_MAX), [items]);

  const simbolo = useMemo(
    () => (oc?.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles"),
    [oc?.monedaSeleccionada]
  );

  // Totales (idéntico a CrearOC.jsx)
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

  // Cuenta BN de detracciones (solo mostrar en PROVEEDOR si existe)
  const detraccionCuenta = useMemo(
    () => oc?.detraccion?.cuenta || findDetraccion(oc?.proveedor?.bancos),
    [oc?.detraccion?.cuenta, oc?.proveedor?.bancos]
  );

  const puedeExportar = useMemo(() => oc?.estado === "Aprobado", [oc?.estado]);
  const puedeFirmar = useMemo(
    () => (!!usuario && oc ? ocPendingForRole(oc, usuario.rol, usuario.email) : false),
    [oc, usuario]
  );

  // Firmas
  const firmaOperaciones = useMemo(() => pickFirma(oc || {}, "firmaOperaciones", "operaciones"), [oc]);
  const firmaGerOp = useMemo(() => pickFirma(oc || {}, "firmaGerenciaOperaciones", "gerenciaOperaciones"), [oc]);
  const firmaGerGral = useMemo(() => pickFirma(oc || {}, "firmaGerenciaGeneral", "gerenciaGeneral"), [oc]);

  // Exportación 1 hoja A4 (márgenes mínimos + contenido compacto)
  const exportarPDF = () => {
    const el = document.getElementById("contenido-oc");
    if (!el) return;
    html2pdf()
      .set({
        margin: [0.25, 0.25, 0.25, 0.25], // pulgadas
        filename: `OC-${oc?.numeroOC || oc?.id || "orden"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 3, scrollY: 0, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all"] },
      })
      .from(el)
      .save();
  };

  // Guards
  if (loading) return <div className="p-6">Cargando usuario…</div>;
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;
  if (oc === null) return <div className="p-6">Cargando orden…</div>;
  if (!oc) return <div className="p-6">No se encontró la orden.</div>;

  return (
    <div className="p-3 md:p-4">
      <div
        id="contenido-oc"
        className="max-w-[794px] mx-auto bg-white text-black"
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: "9px",            // 👈 compacto
          lineHeight: "1.2",          // 👈 compacto
          padding: "10px",            // 👈 compacto
        }}
      >
        {/* ENCABEZADO (compacto) */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-start gap-3">
            <img src={Logo} alt="Logo Memphis" className="h-12" />
            <div>
              <p className="font-bold text-[#004990]">Memphis Maquinarias S.A.C</p>
              <p>RUC: 20603847424</p>
              <p>AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima</p>
              <p>Teléfono: (01) 7174012 — www.memphismaquinarias.com</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-base font-extrabold text-[#004990] leading-tight">ORDEN</h1>
            <p className="font-semibold text-blue-800">N° {oc.numeroOC || oc.id}</p>
            <p>Estado: <b>{oc.estado || "—"}</b></p>
          </div>
        </div>

        {/* DATOS GENERALES */}
        <div className="mb-2">
          <h3 className="font-semibold text-blue-900 mb-1">DATOS GENERALES</h3>
          <div className="grid grid-cols-2 gap-2 border p-2 rounded">
            <div><b>Fecha de Emisión:</b> {oc.fechaEmision || "—"}</div>
            {oc.requerimiento && <div><b>N° Requerimiento:</b> {oc.requerimiento}</div>}
            <div><b>N° Cotización:</b> {oc.cotizacion || "—"}</div>
            <div><b>Centro de Costo:</b> {oc.centroCosto || "—"}</div>
          </div>
        </div>

        {/* PROVEEDOR (con cuenta BN de detracciones si existe) */}
        {oc.tipoOrden !== "OI" && (
          <div className="mb-2">
            <h3 className="font-semibold text-blue-900 mb-1">PROVEEDOR</h3>
            <div className="grid grid-cols-2 gap-2 border p-2 rounded">
              <div><b>Proveedor:</b> {oc.proveedor?.razonSocial || "—"}</div>
              <div><b>RUC:</b> {oc.proveedor?.ruc || "—"}</div>
              <div><b>Dirección:</b> {oc.proveedor?.direccion || "—"}</div>
              <div><b>Contacto:</b> {oc.proveedor?.contacto || "—"}</div>
              <div><b>Teléfono:</b> {oc.proveedor?.telefono || "—"}</div>
              <div><b>Correo:</b> {oc.proveedor?.email || "—"}</div>
              <div><b>Banco:</b> {oc.bancoSeleccionado || "—"}</div>
              <div><b>Moneda:</b> {oc.monedaSeleccionada || simbolo}</div>
              <div><b>Cuenta:</b> {oc.cuenta?.cuenta || "—"}</div>
              <div><b>CCI:</b> {oc.cuenta?.cci || "—"}</div>

              {detraccionCuenta && (
                <>
                  <div className="col-span-2 mt-1 pt-1 border-t">
                    <span className="text-red-700 font-semibold">Cuenta de Detracciones (BN): </span>
                    <span><b>Cuenta:</b> {detraccionCuenta.cuenta || "—"} &nbsp;&nbsp; <b>CCI:</b> {detraccionCuenta.cci || "—"}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* DETALLE (tabla ajustada, máx 15 ítems) */}
        <div className="mb-2">
          <h3 className="font-semibold text-blue-900 mb-1">DETALLE</h3>
          <table className="w-full border border-collapse" style={{ tableLayout: "fixed" }}>
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-1 py-1 w-6">#</th>
                <th className="border px-1 py-1">Descripción</th>
                <th className="border px-1 py-1 w-14">Cant.</th>
                <th className="border px-1 py-1 w-14">U.M.</th>
                <th className="border px-1 py-1 w-20">P. Unit</th>
                <th className="border px-1 py-1 w-20">Dscto</th>
                <th className="border px-1 py-1 w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {itemsToShow.map((it, i) => {
                const c = Number(it.cantidad || 0);
                const pu = Number(it.precioUnitario || 0);
                const ds = Number(it.descuento || 0);
                const tot = c * pu - ds;
                return (
                  <tr key={i} className="text-center">
                    <td className="border px-1 py-1">{i + 1}</td>
                    <td className="border px-1 py-1 text-left">{it.nombre || it.descripcion || "—"}</td>
                    <td className="border px-1 py-1">{c}</td>
                    <td className="border px-1 py-1">{it.unidad || "UND"}</td>
                    <td className="border px-1 py-1 text-right">{formatearMoneda(pu, simbolo)}</td>
                    <td className="border px-1 py-1 text-right">{formatearMoneda(ds, simbolo)}</td>
                    <td className="border px-1 py-1 text-right">{formatearMoneda(tot, simbolo)}</td>
                  </tr>
                );
              })}
              {items.length > ITEMS_MAX && (
                <tr>
                  <td className="border px-1 py-1 text-center text-red-700" colSpan={7}>
                    Se muestran {ITEMS_MAX} de {items.length} ítems para mantener 1 hoja.
                  </td>
                </tr>
              )}
              {itemsToShow.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-500 py-2">Sin ítems.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RESUMEN (box) */}
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div />
          <div className="border rounded p-2">
            <h4 className="font-semibold text-blue-900 mb-1">Resumen</h4>
            <div className="space-y-0.5 text-right">
              <div><b>Subtotal:</b> {formatearMoneda(subtotal, simbolo)}</div>
              <div><b>IGV (18%):</b> {formatearMoneda(igv, simbolo)}</div>
              <div className="text-[10px] font-bold mt-1">
                <b>Total:</b> {formatearMoneda(total, simbolo)}
              </div>
            </div>
          </div>
        </div>

        {/* CONDICIONES (después del resumen) */}
        <div className="mb-2">
          <h3 className="font-semibold text-blue-900 mb-1">CONDICIONES</h3>
          <div className="grid grid-cols-2 gap-2 border p-2 rounded">
            <div><b>Lugar de Entrega:</b> {oc.lugarEntrega || "—"}</div>
            <div><b>Fecha máx. de Entrega:</b> {oc.plazoEntrega || "—"}</div>
            <div><b>Condición de Pago:</b> {oc.condicionPago || "—"}</div>
            <div><b>Observaciones:</b> {oc.notas || "—"}</div>
          </div>
        </div>

        {/* FIRMAS (compactas) */}
        <div className="grid grid-cols-3 gap-4 text-center mt-3">
          {[
            { rol: "Operaciones", src: firmaOperaciones },
            { rol: "Gerencia Operaciones", src: firmaGerOp },
            { rol: "Gerencia General", src: firmaGerGral },
          ].map(({ rol, src }) => (
            <div key={rol} className="flex flex-col items-center">
              {src ? <img src={src} alt={`Firma ${rol}`} className="h-14 object-contain mb-1" /> : <div className="h-14 mb-1" />}
              <p className="font-semibold">{rol}</p>
            </div>
          ))}
        </div>

        {/* PIE (siempre exportable) */}
        <div className="mt-2 text-[8px] leading-snug text-gray-700 border-t pt-1">
          <p className="mb-1 font-semibold">ENVIAR SU COMPROBANTE CON COPIA A:</p>
          <ul className="list-disc pl-4">
            <li>FACTURAS ELECTRÓNICAS: lmeneses@memphis.pe | dmendez@memphis.pe | facturacion@memphis.pe | gomontero@memphis.pe | mcastaneda@memphis.pe | mchuman@memphis.pe</li>
            <li>CONSULTA DE PAGOS: lmeneses@memphis.pe | dmendez@memphis.pe</li>
          </ul>
          <p className="mt-1 italic">
            El presente servicio o producto cumple con los lineamientos de nuestro Sistema de Gestión Antisoborno.
          </p>
        </div>
      </div>

      {/* ACCIONES */}
      <div className="mt-3 flex gap-3">
        {puedeFirmar && (
          <button
            onClick={() => navigate(`/firmar?id=${oc.id}`)}
            className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
          >
            Aprobar / Rechazar OC
          </button>
        )}
        {puedeExportar && (
          <button
            onClick={exportarPDF}
            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
          >
            Exportar PDF
          </button>
        )}
      </div>
    </div>
  );
};

export default VerOC;
