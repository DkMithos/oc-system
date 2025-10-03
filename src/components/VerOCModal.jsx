// ✅ src/components/VerOCModal.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import html2pdf from "html2pdf.js";
import { formatearMoneda } from "../utils/formatearMoneda";
import FirmarOCModal from "./FirmarOCModal";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";
import { ocPendingForRole } from "../utils/aprobaciones";

const up = (s = "") => (s || "").toString().toUpperCase();
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

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

// Compat firmas
const pickFirma = (oc, plano, obj) => oc?.[plano] || oc?.firmas?.[obj] || null;

// ✅ Cálculo EXACTO a CrearOC.jsx
const calcTotalsExact = (oc) => {
  const items = Array.isArray(oc?.items) ? oc.items : [];
  const sub = items.reduce((acc, it) => {
    const cantidad = Number(it.cantidad || 0);
    const pu = Number(it.precioUnitario || 0);
    const dscto = Number(it.descuento || 0);
    return acc + (cantidad * pu - dscto);
  }, 0);
  const subtotal = sub;
  const igv = round2(subtotal * 0.18);
  const otros = Number(oc?.resumen?.otros || 0);
  const total = round2(subtotal + igv + otros);
  return { subtotal, igv, otros, total };
};

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
  const contRef = useRef(null);

  useEffect(() => setOcLocal(oc), [oc]);

  const simbolo = ocLocal.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";

  // 👉 Totales EXACTOS como en CrearOC.jsx
  const { subtotal, igv, otros, total } = useMemo(
    () => calcTotalsExact(ocLocal),
    [ocLocal]
  );

  const calcNeto = (it) =>
    Number(it.precioUnitario || 0) - Number(it.descuento || 0);
  const calcItemTotal = (it) => calcNeto(it) * Number(it.cantidad || 0);

  const detr = ocLocal?.detraccion || {};
  const detrCuentaBN = detr?.cuentaBN || findDetraccion(ocLocal.proveedor?.bancos) || {};
  const aplicaDetr = !!detr?.aplica || !!detrCuentaBN?.cuenta || !!detrCuentaBN?.cci;

  const puedeExportar = ocLocal.estado === "Aprobado";
  const puedeFirmar = !!usuario && ocPendingForRole(ocLocal, usuario.rol, usuario.email);

  const exportarPDF = () => {
    const el = contRef.current || document.getElementById("modal-oc-print");
    if (!el) return;
    html2pdf()
      .set({
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `OC-${ocLocal.numeroOC || ocLocal.id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 3, scrollY: 0, useCORS: true },
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

  // Firmas (compat)
  const firmaOperaciones = pickFirma(ocLocal, "firmaOperaciones", "operaciones");
  const firmaGerOp = pickFirma(ocLocal, "firmaGerenciaOperaciones", "gerenciaOperaciones");
  const firmaGerGral = pickFirma(ocLocal, "firmaGerenciaGeneral", "gerenciaGeneral");

  return (
    <ModalShell title={`Orden ${ocLocal.numeroOC || ""}`} onClose={onClose}>
      <div id="modal-oc-print" ref={contRef} className="p-4 text-[12px] leading-tight">
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
            <p className="text-sm font-semibold text-blue-800">
              N° {ocLocal.numeroOC || ocLocal.id}
            </p>
            <p className="text-[11px] text-gray-700">
              Estado: <b>{ocLocal.estado || "—"}</b>
            </p>
          </div>
        </div>

        {/* Datos generales */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DATOS GENERALES</h3>
        <div className="grid grid-cols-2 gap-3 mb-3 border p-3 rounded">
          <div><strong>Fecha de Emisión:</strong> {ocLocal.fechaEmision || "—"}</div>
          {ocLocal.requerimiento && (
            <div><strong>N° Requerimiento:</strong> {ocLocal.requerimiento}</div>
          )}
          <div><strong>N° Cotización:</strong> {ocLocal.cotizacion || "—"}</div>
          <div><strong>Centro de Costo:</strong> {ocLocal.centroCosto || "—"}</div>
        </div>

        {/* Proveedor */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">PROVEEDOR</h3>
        <div className="grid grid-cols-2 gap-3 mb-4 border p-3 rounded">
          <div><strong>Proveedor:</strong> {ocLocal.proveedor?.razonSocial || "—"}</div>
          <div><strong>RUC:</strong> {ocLocal.proveedor?.ruc || "—"}</div>
          <div><strong>Dirección:</strong> {ocLocal.proveedor?.direccion || "—"}</div>
          <div><strong>Contacto:</strong> {ocLocal.proveedor?.contacto || "—"}</div>
          <div><strong>Teléfono:</strong> {ocLocal.proveedor?.telefono || "—"}</div>
          <div><strong>Correo:</strong> {ocLocal.proveedor?.email || "—"}</div>
          <div><strong>Banco:</strong> {ocLocal.bancoSeleccionado || "—"}</div>
          <div><strong>Moneda:</strong> {ocLocal.monedaSeleccionada || "—"}</div>
          <div><strong>Cuenta:</strong> {ocLocal.cuenta?.cuenta || "-"}</div>
          <div><strong>CCI:</strong> {ocLocal.cuenta?.cci || "-"}</div>

          {(aplicaDetr || detrCuentaBN?.cuenta || detrCuentaBN?.cci) && (
            <>
              <div className="col-span-2 mt-2 pt-2 border-t">
                <span className="text-red-700 font-semibold">Cuenta de Detracciones (BN)</span>
              </div>
              <div><strong>Cuenta:</strong> {detrCuentaBN.cuenta || "—"}</div>
              <div><strong>CCI:</strong> {detrCuentaBN.cci || "—"}</div>
            </>
          )}
        </div>

        {/* Condiciones */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">CONDICIONES</h3>
        <div className="grid grid-cols-2 gap-3 mb-3 border p-3 rounded">
          <div><strong>Lugar de Entrega:</strong> {ocLocal?.condiciones?.lugarEntrega || "—"}</div>
          <div><strong>Fecha máx. de Entrega:</strong> {ocLocal?.condiciones?.fechaEntregaMax || "—"}</div>
          <div><strong>Condición de Pago:</strong> {ocLocal?.condiciones?.condicionPago || "—"}</div>
          <div className="col-span-2"><strong>Observaciones:</strong> {ocLocal?.condiciones?.observaciones || "—"}</div>
        </div>

        {/* Detalle */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DETALLE</h3>
        <table className="w-full text-[11px] border border-collapse mb-3">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1 text-left">Descripción</th>
              <th className="border px-2 py-1">Cant.</th>
              <th className="border px-2 py-1">P. Unit</th>
              <th className="border px-2 py-1">Descuento</th>
              <th className="border px-2 py-1">Neto</th>
              <th className="border px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {(ocLocal.items || []).map((it, i) => {
              const neto = calcNeto(it);
              const totalIt = calcItemTotal(it);
              return (
                <tr key={i} className="text-center">
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1 text-left">{it.nombre || it.descripcion || "—"}</td>
                  <td className="border px-2 py-1">{it.cantidad}</td>
                  <td className="border px-2 py-1">{formatearMoneda(it.precioUnitario, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(it.descuento || 0, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(neto, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(totalIt, simbolo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Resumen + Detracción */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded p-3 text-[11px]">
            <h4 className="font-semibold mb-1">Detracción</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><strong>Aplica:</strong> {aplicaDetr ? "Sí" : "No"}</div>
              <div><strong>%:</strong> {ocLocal?.detraccion?.pct ?? "—"}</div>
              <div><strong>Base:</strong> {ocLocal?.detraccion?.base || "valorVenta"}</div>
              <div><strong>Código SUNAT:</strong> {ocLocal?.detraccion?.codigo || "—"}</div>
              <div className="col-span-2">
                <strong>Cuenta BN:</strong> {ocLocal?.detraccion?.cuentaBN || detrCuentaBN?.cuenta || "—"}
              </div>
            </div>
          </div>

          <div className="border rounded p-3 text-[12px]">
            <h4 className="font-semibold mb-1">Resumen</h4>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatearMoneda(subtotal, simbolo)}</span>
            </div>
            <div className="flex justify-between">
              <span>IGV (18%)</span>
              <span>{formatearMoneda(igv, simbolo)}</span>
            </div>
            <div className="flex justify-between">
              <span>Otros</span>
              <span>{formatearMoneda(otros, simbolo)}</span>
            </div>
            <div className="flex justify-between border-t mt-1 pt-1 font-semibold">
              <span>Total</span>
              <span>{formatearMoneda(total, simbolo)}</span>
            </div>
          </div>
        </div>

        {/* Firmas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mt-10 text-[11px]">
          {[
            { rol: "Operaciones", src: firmaOperaciones },
            { rol: "Gerencia Operaciones", src: firmaGerOp },
            { rol: "Gerencia General", src: firmaGerGral },
          ].map(({ rol, src }) => (
            <div key={rol} className="flex flex-col items-center justify-end">
              {src ? (
                <img src={src} alt={`Firma ${rol}`} className="h-20 object-contain mb-2" crossOrigin="anonymous" />
              ) : (
                <div className="h-20 mb-2" />
              )}
              <p className="font-semibold">{rol}</p>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div className="mt-4 text-[9px] leading-snug text-gray-700 border-t pt-2">
          <p className="mb-1 font-semibold">ENVIAR SU COMPROBANTE CON COPIA A:</p>
          <ul className="list-disc pl-4">
            <li>
              FACTURAS ELECTRÓNICAS: lmeneses@memphis.pe | dmendez@memphis.pe |
              {" "}facturacion@memphis.pe | gomontero@memphis.pe |
              {" "}mcastaneda@memphis.pe | mchuman@memphis.pe
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
        <div className="text-xs text-gray-500">
          Estado: <b>{ocLocal.estado || "—"}</b>
        </div>
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
            <button
              onClick={exportarPDF}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Exportar PDF
            </button>
          )}
          <button onClick={onClose} className="bg-gray-100 px-3 py-1 rounded hover:bg-gray-200">
            Cerrar
          </button>
        </div>
      </div>

      {firmarAbierto && (
        <FirmarOCModal oc={ocLocal} onClose={() => setFirmarAbierto(false)} onFirmado={handleFirmado} />
      )}
    </ModalShell>
  );
};

export default VerOCModal;
