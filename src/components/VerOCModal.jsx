// ✅ src/components/VerOCModal.jsx
import React, { useMemo, useState } from "react";
import html2pdf from "html2pdf.js";
import { formatearMoneda } from "../utils/formatearMoneda";
import FirmarOCModal from "./FirmarOCModal";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";

// Detección de detracción
const findDetraccion = (bancos = []) => {
  if (!Array.isArray(bancos)) return null;
  const up = (s = "") => s.toUpperCase();
  return bancos.find(
    (b) =>
      up(b?.nombre).includes("DETRACC") ||
      up(b?.nombre) === "BN" ||
      up(b?.nombre).includes("BANCO DE LA NACION")
  ) || null;
};

const ModalShell = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button onClick={onClose} className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200">Cerrar</button>
      </div>
      {children}
    </div>
  </div>
);

const VerOCModal = ({ oc, onClose }) => {
  const { usuario } = useUsuario();
  const [firmarAbierto, setFirmarAbierto] = useState(false);

  const simbolo = oc.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";
  const subtotal = useMemo(
    () => (oc.items || []).reduce((acc, it) => acc + (Number(it.precioUnitario) - Number(it.descuento || 0)) * Number(it.cantidad || 0), 0),
    [oc.items]
  );
  const igv = subtotal * 0.18;
  const otros = Number(oc?.resumen?.otros || 0);
  const total = subtotal + igv + otros;

  const detraccionCuenta = oc.detraccion || findDetraccion(oc.proveedor?.bancos);

  const puedeExportar =
    oc.estado === "Aprobado por Gerencia" ||
    (oc.monedaSeleccionada === "Soles" && total <= 3500) ||
    (oc.monedaSeleccionada === "Dólares" && total <= 1000);

  const puedeFirmar =
    (usuario?.rol === "operaciones" && oc.estado === "Pendiente de Operaciones") ||
    (usuario?.rol === "gerencia" && oc.estado === "Aprobado por Operaciones");

  const exportarPDF = () => {
    const elemento = document.getElementById("modal-oc-print");
    if (!elemento) return;
    const opciones = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: `OC-${oc.numeroOC}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 3, scrollY: 0 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };
    html2pdf().set(opciones).from(elemento).save();
  };

  return (
    <ModalShell title={`Orden de Compra ${oc.numeroOC || ""}`} onClose={onClose}>
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
            <h1 className="text-lg font-bold text-[#004990]">ORDEN DE COMPRA</h1>
            <p className="text-sm font-semibold text-blue-800">N° {oc.numeroOC || oc.id}</p>
          </div>
        </div>

        {/* Datos generales */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DATOS GENERALES</h3>
        <div className="grid grid-cols-2 gap-3 mb-3 border p-3 rounded">
          <div><strong>Fecha de Emisión:</strong> {oc.fechaEmision}</div>
          {oc.requerimiento && <div><strong>N° Requerimiento:</strong> {oc.requerimiento}</div>}
          <div><strong>N° Cotización:</strong> {oc.cotizacion}</div>
          <div><strong>Centro de Costo:</strong> {oc.centroCosto}</div>
        </div>

        {/* Proveedor */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">PROVEEDOR</h3>
        <div className="grid grid-cols-2 gap-3 mb-4 border p-3 rounded">
          <div><strong>Proveedor:</strong> {oc.proveedor?.razonSocial}</div>
          <div><strong>RUC:</strong> {oc.proveedor?.ruc}</div>
          <div><strong>Dirección:</strong> {oc.proveedor?.direccion}</div>
          <div><strong>Contacto:</strong> {oc.proveedor?.contacto}</div>
          <div><strong>Teléfono:</strong> {oc.proveedor?.telefono}</div>
          <div><strong>Correo:</strong> {oc.proveedor?.email}</div>
          <div><strong>Banco:</strong> {oc.bancoSeleccionado}</div>
          <div><strong>Moneda:</strong> {oc.monedaSeleccionada}</div>
          <div><strong>Cuenta:</strong> {oc.cuenta?.cuenta || "-"}</div>
          <div><strong>CCI:</strong> {oc.cuenta?.cci || "-"}</div>

          {detraccionCuenta && (
            <>
              <div className="col-span-2 mt-2 pt-2 border-t">
                <span className="text-red-700 font-semibold">
                  Cuenta de Detracciones (BN)
                </span>
              </div>
              <div><strong>Cuenta:</strong> {detraccionCuenta.cuenta || "—"}</div>
              <div><strong>CCI:</strong> {detraccionCuenta.cci || "—"}</div>
            </>
          )}
        </div>

        {/* Detalle */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DETALLE DE COMPRA</h3>
        <table className="w-full text-[11px] border border-collapse mb-3">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Descripción</th>
              <th className="border px-2 py-1">Cantidad</th>
              <th className="border px-2 py-1">P. Unit</th>
              <th className="border px-2 py-1">Descuento</th>
              <th className="border px-2 py-1">Neto</th>
              <th className="border px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {(oc.items || []).map((item, i) => {
              const neto = Number(item.precioUnitario) - Number(item.descuento || 0);
              const totalItem = neto * Number(item.cantidad || 0);
              return (
                <tr key={i} className="text-center">
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{item.nombre}</td>
                  <td className="border px-2 py-1">{item.cantidad}</td>
                  <td className="border px-2 py-1">{formatearMoneda(item.precioUnitario, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(item.descuento || 0, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(neto, simbolo)}</td>
                  <td className="border px-2 py-1">{formatearMoneda(totalItem, simbolo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totales */}
        <h3 className="text-right text-sm font-semibold mb-1 text-blue-900">RESUMEN</h3>
        <div className="text-right mb-4 pr-2 space-y-0.5">
          <p><strong>Subtotal:</strong> {formatearMoneda(subtotal, simbolo)}</p>
          <p><strong>IGV (18%):</strong> {formatearMoneda(igv, simbolo)}</p>
          <p><strong>Otros:</strong> {formatearMoneda(otros, simbolo)}</p>
          <p className="text-sm font-bold mt-1"><strong>Total:</strong> {formatearMoneda(total, simbolo)}</p>
        </div>

        {/* Condiciones */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">CONDICIONES DE ENTREGA</h3>
        <div className="grid grid-cols-2 gap-3 mb-4 border p-3 rounded">
          <div><span className="font-semibold">Lugar de entrega:</span><p>{oc.lugarEntrega}</p></div>
          <div><span className="font-semibold">Fecha de entrega:</span><p>{oc.fechaEntrega}</p></div>
          <div><span className="font-semibold">Condición de pago:</span><p>{oc.condicionPago}</p></div>
          <div><span className="font-semibold">Observaciones:</span><p>{oc.observaciones || "—"}</p></div>
        </div>

        {/* Firmas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mt-10 text-[11px]">
          {["Comprador", "Operaciones", "Gerencia"].map((rol) => {
            const firmas = {
              Comprador: oc.firmaComprador,
              Operaciones: oc.firmaOperaciones,
              Gerencia: oc.firmaGerencia,
            };
            return (
              <div key={rol} className="flex flex-col items-center justify-end">
                {firmas[rol] ? (
                  <img src={firmas[rol]} alt={`Firma ${rol}`} className="h-20 object-contain mb-2" />
                ) : (
                  <div className="h-20 mb-2" />
                )}
                <p className="font-semibold">{rol}</p>
              </div>
            );
          })}
        </div>

        {/* Pie */}
        <div className="mt-4 text-[9px] leading-snug text-gray-700 border-t pt-2">
          <p className="mb-1 font-semibold">ENVIAR SU COMPROBANTE CON COPIA A LOS SIGUIENTES CORREOS:</p>
          <ul className="list-disc pl-4">
            <li>FACTURAS ELECTRÓNICAS: lmeneses@memphis.pe | dmendez@memphis.pe | facturacion@memphis.pe | gomontero@memphis.pe | mcastaneda@memphis.pe | mchuman@memphis.pe</li>
            <li>CONSULTA DE PAGOS: lmeneses@memphis.pe | dmendez@memphis.pe</li>
          </ul>
          <p className="mt-1 italic">
            El presente servicio o producto cumple con los lineamientos de nuestro Sistema de Gestión Antisoborno.
          </p>
        </div>
      </div>

      {/* Footer acciones del modal principal */}
      <div className="flex items-center justify-between p-3 border-t">
        <div className="text-xs text-gray-500">Estado: <b>{oc.estado}</b></div>
        <div className="flex gap-2">
          { // Solo muestra Aprobar/Rechazar si corresponde al rol/estado
            ((usuario?.rol === "operaciones" && oc.estado === "Pendiente de Operaciones") ||
             (usuario?.rol === "gerencia" && oc.estado === "Aprobado por Operaciones")) && (
              <button
                onClick={() => setFirmarAbierto(true)}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                Aprobar / Rechazar
              </button>
            )
          }
          {puedeExportar && (
            <button onClick={exportarPDF} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
              Exportar PDF
            </button>
          )}

        </div>
      </div>

      {/* Modal de firma */}
      {firmarAbierto && (
        <FirmarOCModal oc={oc} onClose={() => setFirmarAbierto(false)} />
      )}
    </ModalShell>
  );
};

export default VerOCModal;
