// ✅ src/components/VerOCModal.jsx (mismos criterios: 1 hoja, máx. 15 ítems, sin box de detracción)
import React, { useEffect, useMemo, useState } from "react";
import html2pdf from "html2pdf.js";
import { formatearMoneda } from "../utils/formatearMoneda";
import FirmarOCModal from "./FirmarOCModal";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";
import { ocPendingForRole } from "../utils/aprobaciones";

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

const ITEMS_MAX = 15;

const ModalShell = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
      <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-2 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button onClick={onClose} className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200">
          Cerrar
        </button>
      </div>
      {children}
    </div>
  </div>
);

const VerOCModal = ({ oc, onClose, onUpdated }) => {
  const { usuario } = useUsuario();
  const [firmarAbierto, setFirmarAbierto] = useState(false);
  const [ocLocal, setOcLocal] = useState(oc);
  useEffect(() => setOcLocal(oc), [oc]);

  const items = useMemo(() => (Array.isArray(ocLocal?.items) ? ocLocal.items : []), [ocLocal?.items]);
  const itemsToShow = useMemo(() => items.slice(0, ITEMS_MAX), [items]);

  const simbolo = useMemo(
    () => (ocLocal?.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles"),
    [ocLocal?.monedaSeleccionada]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (acc, it) =>
          acc +
          (Number(it.cantidad || 0) * Number(it.precioUnitario || 0) -
            Number(it.descuento || 0)),
        0
      ),
    [items]
  );
  const igv = useMemo(() => Math.round(subtotal * 0.18 * 100) / 100, [subtotal]);
  const total = useMemo(() => Math.round((subtotal + igv) * 100) / 100, [subtotal, igv]);

  const detraccionCuenta = useMemo(
    () => ocLocal?.detraccion?.cuenta || findDetraccion(ocLocal?.proveedor?.bancos),
    [ocLocal?.detraccion?.cuenta, ocLocal?.proveedor?.bancos]
  );

  const puedeExportar = ocLocal?.estado === "Aprobado";
  const puedeFirmar = !!usuario && ocPendingForRole(ocLocal, usuario.rol, usuario.email);

  const exportarPDF = () => {
    const el = document.getElementById("modal-oc-print");
    if (!el) return;
    html2pdf()
      .set({
        margin: [0.25, 0.25, 0.25, 0.25],
        filename: `OC-${ocLocal.numeroOC || ocLocal.id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 3, scrollY: 0 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all"] },
      })
      .from(el)
      .save();
  };

  const handleFirmado = (ocActualizada) => {
    setFirmarAbierto(false);
    setOcLocal(ocActualizada);
    onUpdated?.(ocActualizada);
  };

  const firmaOperaciones = useMemo(() => pickFirma(ocLocal || {}, "firmaOperaciones", "operaciones"), [ocLocal]);
  const firmaGerOp = useMemo(() => pickFirma(ocLocal || {}, "firmaGerenciaOperaciones", "gerenciaOperaciones"), [ocLocal]);
  const firmaGerGral = useMemo(() => pickFirma(ocLocal || {}, "firmaGerenciaGeneral", "gerenciaGeneral"), [ocLocal]);

  return (
    <ModalShell title={`Orden ${ocLocal.numeroOC || ""}`} onClose={onClose}>
      <div id="modal-oc-print" className="p-3" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, lineHeight: 1.25 }}>
        {/* Encabezado */}
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
            <p className="font-semibold text-blue-800">N° {ocLocal.numeroOC || ocLocal.id}</p>
            <p>Estado: <b>{ocLocal.estado || "—"}</b></p>
          </div>
        </div>

        {/* Datos generales */}
        <div className="mb-2">
          <h3 className="font-semibold text-blue-900 mb-1">DATOS GENERALES</h3>
          <div className="grid grid-cols-2 gap-2 border p-2 rounded">
            <div><b>Fecha de Emisión:</b> {ocLocal.fechaEmision || "—"}</div>
            {ocLocal.requerimiento && <div><b>N° Requerimiento:</b> {ocLocal.requerimiento}</div>}
            <div><b>N° Cotización:</b> {ocLocal.cotizacion || "—"}</div>
            <div><b>Centro de Costo:</b> {ocLocal.centroCosto || "—"}</div>
          </div>
        </div>

        {/* Proveedor */}
        {ocLocal.tipoOrden !== "OI" && (
          <div className="mb-2">
            <h3 className="font-semibold text-blue-900 mb-1">PROVEEDOR</h3>
            <div className="grid grid-cols-2 gap-2 border p-2 rounded">
              <div><b>Proveedor:</b> {ocLocal.proveedor?.razonSocial || "—"}</div>
              <div><b>RUC:</b> {ocLocal.proveedor?.ruc || "—"}</div>
              <div><b>Dirección:</b> {ocLocal.proveedor?.direccion || "—"}</div>
              <div><b>Contacto:</b> {ocLocal.proveedor?.contacto || "—"}</div>
              <div><b>Teléfono:</b> {ocLocal.proveedor?.telefono || "—"}</div>
              <div><b>Correo:</b> {ocLocal.proveedor?.email || "—"}</div>
              <div><b>Banco:</b> {ocLocal.bancoSeleccionado || "—"}</div>
              <div><b>Moneda:</b> {ocLocal.monedaSeleccionada || simbolo}</div>
              <div><b>Cuenta:</b> {ocLocal.cuenta?.cuenta || "—"}</div>
              <div><b>CCI:</b> {ocLocal.cuenta?.cci || "—"}</div>

              {detraccionCuenta && (
                <div className="col-span-2 mt-1 pt-1 border-t">
                  <span className="text-red-700 font-semibold">Cuenta de Detracciones (BN): </span>
                  <span><b>Cuenta:</b> {detraccionCuenta.cuenta || "—"} &nbsp;&nbsp; <b>CCI:</b> {detraccionCuenta.cci || "—"}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detalle (máx. 15) */}
        <div className="mb-2">
          <h3 className="font-semibold text-blue-900 mb-1">DETALLE</h3>
          <table className="w-full border border-collapse" style={{ tableLayout: "fixed" }}>
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-1 py-1 w-6">#</th>
                <th className="border px-1 py-1">Descripción</th>
                <th className="border px-1 py-1 w-16">Cant.</th>
                <th className="border px-1 py-1 w-16">U.M.</th>
                <th className="border px-1 py-1 w-24">P. Unit</th>
                <th className="border px-1 py-1 w-24">Dscto</th>
                <th className="border px-1 py-1 w-24">Total</th>
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
            </tbody>
          </table>
        </div>

        {/* Resumen (box) */}
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div />
          <div className="border rounded p-2">
            <h4 className="font-semibold text-blue-900 mb-1">Resumen</h4>
            <div className="space-y-0.5 text-right">
              <div><b>Subtotal:</b> {formatearMoneda(subtotal, simbolo)}</div>
              <div><b>IGV (18%):</b> {formatearMoneda(igv, simbolo)}</div>
              <div className="text-[12px] font-bold mt-1">
                <b>Total:</b> {formatearMoneda(total, simbolo)}
              </div>
            </div>
          </div>
        </div>

        {/* Condiciones después del resumen */}
        <div className="mb-2">
          <h3 className="font-semibold text-blue-900 mb-1">CONDICIONES</h3>
          <div className="grid grid-cols-2 gap-2 border p-2 rounded">
            <div><b>Lugar de Entrega:</b> {ocLocal.lugarEntrega || "—"}</div>
            <div><b>Fecha máx. de Entrega:</b> {ocLocal.plazoEntrega || "—"}</div>
            <div><b>Condición de Pago:</b> {ocLocal.condicionPago || "—"}</div>
            <div><b>Notas:</b> {ocLocal.notas || "—"}</div>
          </div>
        </div>

        {/* Firmas (compactas) */}
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

        {/* Pie */}
        <div className="mt-2 text-[9px] leading-snug text-gray-700 border-t pt-1">
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

      {/* acciones */}
      <div className="sticky bottom-0 bg-white flex items-center justify-between p-2 border-t">
        <div className="text-xs text-gray-500">Estado: <b>{ocLocal.estado || "—"}</b></div>
        <div className="flex gap-2">
          {puedeFirmar && (
            <button
              onClick={() => setFirmarAbierto(true)}
              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Aprobar / Rechazar
            </button>
          )}
          {puedeExportar && (
            <button onClick={exportarPDF} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {firmarAbierto && (
        <FirmarOCModal
          oc={ocLocal}
          onClose={() => setFirmarAbierto(false)}
          onSigned={handleFirmado}
        />
      )}
    </ModalShell>
  );
};

export default VerOCModal;
