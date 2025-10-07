// ✅ src/components/VerOCModal.jsx (Detracción + Resumen en boxes, Condiciones después, footer visible)
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

const ModalShell = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
      <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-3 border-b">
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
  const valorVenta = subtotal;

  const detObj = ocLocal?.detraccion || {};
  const detraccionCuenta = useMemo(
    () => detObj?.cuenta || findDetraccion(ocLocal?.proveedor?.bancos),
    [detObj?.cuenta, ocLocal?.proveedor?.bancos]
  );
  const detAplica = !!detObj?.aplica || Number(detObj?.porcentaje || 0) > 0;
  const detPct = Number(detObj?.porcentaje || 0);
  const detCodigoSunat = detObj?.codigoSunat || detObj?.codigo || "";

  const puedeExportar = ocLocal?.estado === "Aprobado";
  const puedeFirmar = !!usuario && ocPendingForRole(ocLocal, usuario.rol, usuario.email);

  const exportarPDF = () => {
    const el = document.getElementById("modal-oc-print");
    if (!el) return;
    html2pdf()
      .set({
        margin: [0.4, 0.4, 0.4, 0.4],
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

  const firmaOperaciones = useMemo(
    () => pickFirma(ocLocal || {}, "firmaOperaciones", "operaciones"),
    [ocLocal]
  );
  const firmaGerOp = useMemo(
    () => pickFirma(ocLocal || {}, "firmaGerenciaOperaciones", "gerenciaOperaciones"),
    [ocLocal]
  );
  const firmaGerGral = useMemo(
    () => pickFirma(ocLocal || {}, "firmaGerenciaGeneral", "gerenciaGeneral"),
    [ocLocal]
  );

  return (
    <ModalShell title={`Orden ${ocLocal.numeroOC || ""}`} onClose={onClose}>
      <div id="modal-oc-print" className="p-4 text-[12px] leading-tight">
        {/* Encabezado */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-4">
            <img src={Logo} alt="Logo Memphis" className="h-14" />
            <div className="text-[11px] leading-tight">
              <p className="font-bold text-[#004990]">Memphis Maquinarias S.A.C</p>
              <p>RUC: 20603847424</p>
              <p>AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima</p>
              <p>Teléfono: (01) 7174012</p>
              <p>www.memphismaquinarias.com</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold text-[#004990]">ORDEN</h1>
            <p className="text-sm font-semibold text-blue-800">N° {ocLocal.numeroOC || ocLocal.id}</p>
            <p className="text-[11px] mt-1">Estado: <b>{ocLocal.estado || "—"}</b></p>
          </div>
        </div>

        {/* Datos generales */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DATOS GENERALES</h3>
        <div className="grid grid-cols-2 gap-3 mb-3 border p-3 rounded">
          <div><strong>Fecha de Emisión:</strong> {ocLocal.fechaEmision || "—"}</div>
          {ocLocal.requerimiento && <div><strong>N° Requerimiento:</strong> {ocLocal.requerimiento}</div>}
          <div><strong>N° Cotización:</strong> {ocLocal.cotizacion || "—"}</div>
          <div><strong>Centro de Costo:</strong> {ocLocal.centroCosto || "—"}</div>
        </div>

        {/* Proveedor (solo OC/OS) */}
        {ocLocal.tipoOrden !== "OI" && (
          <>
            <h3 className="text-sm font-semibold mb-1 text-blue-900">PROVEEDOR</h3>
            <div className="grid grid-cols-2 gap-3 mb-4 border p-3 rounded">
              <div><strong>Proveedor:</strong> {ocLocal.proveedor?.razonSocial || "—"}</div>
              <div><strong>RUC:</strong> {ocLocal.proveedor?.ruc || "—"}</div>
              <div><strong>Dirección:</strong> {ocLocal.proveedor?.direccion || "—"}</div>
              <div><strong>Contacto:</strong> {ocLocal.proveedor?.contacto || "—"}</div>
              <div><strong>Teléfono:</strong> {ocLocal.proveedor?.telefono || "—"}</div>
              <div><strong>Correo:</strong> {ocLocal.proveedor?.email || "—"}</div>
              <div><strong>Banco:</strong> {ocLocal.bancoSeleccionado || "—"}</div>
              <div><strong>Moneda:</strong> {ocLocal.monedaSeleccionada || simbolo}</div>
              <div><strong>Cuenta:</strong> {ocLocal.cuenta?.cuenta || "—"}</div>
              <div><strong>CCI:</strong> {ocLocal.cuenta?.cci || "—"}</div>

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

        {/* Detalle */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DETALLE</h3>
        <table className="w-full text-[11px] border border-collapse mb-3">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Descripción</th>
              <th className="border px-2 py-1">Cant.</th>
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
              const totalIt = cantidad * pu - dscto;
              return (
                <tr key={i} className="text-center">
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{it.nombre || it.descripcion || "—"}</td>
                  <td className="border px-2 py-1">{cantidad}</td>
                  <td className="border px-2 py-1">{it.unidad || "UND"}</td>
                  <td className="border px-2 py-1">{formatearMoneda(pu, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(dscto, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(totalIt, simbolo)}</td>
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

        {/* Detracción + Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="border rounded p-3">
            <h4 className="font-semibold text-blue-900 mb-2">Detracción</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div><strong>Aplica:</strong> {detAplica ? "Sí" : "No"}</div>
              <div><strong>%:</strong> {detPct > 0 ? `${detPct}%` : "—"}</div>
              <div><strong>Base:</strong> Valor Venta</div>
              <div><strong>Código SUNAT:</strong> {detCodigoSunat || "—"}</div>
              <div className="col-span-2"><strong>Base (monto):</strong> {formatearMoneda(valorVenta, simbolo)}</div>
              <div className="col-span-2"><strong>Cuenta BN:</strong> {detraccionCuenta?.cuenta || "—"}</div>
            </div>
          </div>

          <div className="border rounded p-3">
            <h4 className="font-semibold text-blue-900 mb-2">Resumen</h4>
            <div className="space-y-1 text-right pr-2">
              <div><strong>Subtotal:</strong> {formatearMoneda(subtotal, simbolo)}</div>
              <div><strong>IGV (18%):</strong> {formatearMoneda(igv, simbolo)}</div>
              <div className="text-sm font-bold mt-1">
                <strong>Total:</strong> {formatearMoneda(total, simbolo)}
              </div>
            </div>
          </div>
        </div>

        {/* Condiciones (después del Resumen) */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">CONDICIONES</h3>
        <div className="grid grid-cols-2 gap-3 mb-4 border p-3 rounded">
          <div><strong>Lugar de Entrega:</strong> {ocLocal.lugarEntrega || "—"}</div>
          <div><strong>Fecha máx. de Entrega:</strong> {ocLocal.plazoEntrega || "—"}</div>
          <div><strong>Condición de Pago:</strong> {ocLocal.condicionPago || "—"}</div>
          <div><strong>Observaciones:</strong> {ocLocal.notas || "—"}</div>
        </div>

        {/* Pie */}
        <div className="mt-4 text-[9px] leading-snug text-gray-700 border-t pt-2">
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

      {/* Footer acciones */}
      <div className="sticky bottom-0 bg-white flex items-center justify-between p-3 border-t">
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
