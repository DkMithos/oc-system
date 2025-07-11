import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { obtenerOCporId } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";

const VerOC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");
  const stateOC = location.state?.orden;

  const { usuario, loading } = useUsuario();
  const [oc, setOC] = useState(null);

  useEffect(() => {
    const cargarOrden = async () => {
      if (stateOC) {
        setOC(stateOC);
      } else if (ocId) {
        const encontrada = await obtenerOCporId(ocId);
        setOC(encontrada || null);
      }
    };

    cargarOrden();
  }, [ocId, stateOC]);

  if (loading) return <div className="p-6">Cargando usuario...</div>;
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;
  if (!oc) return <div className="p-6">Cargando orden de compra...</div>;
  if (!oc.items) return <div className="p-6">Orden no válida o vacía.</div>;

  const calcularNeto = (item) => (item.precioUnitario - item.descuento) * item.cantidad;
  const subtotal = oc.items.reduce((acc, item) => acc + calcularNeto(item), 0);
  const igv = subtotal * 0.18;
  const otros = oc.resumen?.otros || 0;
  const total = subtotal + igv + otros;
  const simbolo = oc.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";

  const puedeExportar =
    oc.estado === "Aprobado por Gerencia" ||
    (oc.monedaSeleccionada === "Soles" && total <= 3500) ||
    (oc.monedaSeleccionada === "Dólares" && total <= 1000);

  const puedeFirmar =
    (usuario.rol === "operaciones" && oc.estado === "Pendiente de Operaciones") ||
    (usuario.rol === "gerencia" && oc.estado === "Aprobado por Operaciones");

  const exportarPDF = () => {
    const elemento = document.getElementById("contenido-oc");
    if (!elemento) {
      alert("No se encontró el contenido para exportar.");
      return;
    }

    const opciones = {
      margin: [0.3, 0.3, 0.3, 0.3],
      filename: `OC-${oc.id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };

    html2pdf().set(opciones).from(elemento).save();
  };

  return (
    <div className="p-4 md:p-6">
      <div
        id="contenido-oc"
        className="text-xs leading-tight max-w-[794px] mx-auto p-4 bg-white text-black"
        style={{ fontSize: "10px", fontFamily: "Arial, sans-serif" }}
      >
        {/* LOGO + INFORMACIÓN DE EMPRESA + TÍTULO */}
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
            <h1 className="text-lg font-bold text-[#004990]">ORDEN DE COMPRA</h1>
            <p className="text-sm font-semibold text-blue-800">N° {oc.numeroOC || oc.id}</p>
          </div>
        </div>

        {/* DATOS GENERALES */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DATOS GENERALES</h3>
        <div className="grid grid-cols-2 gap-2 mb-2 border p-2 rounded">
          <div><strong>Fecha de Emisión:</strong> {oc.fechaEmision}</div>
          {oc.requerimiento && <div><strong>N° Requerimiento:</strong> {oc.requerimiento}</div>}
          <div><strong>N° Cotización:</strong> {oc.cotizacion}</div>
          <div><strong>Centro de Costo:</strong> {oc.centroCosto}</div>
        </div>

        {/* PROVEEDOR */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">PROVEEDOR</h3>
        <div className="grid grid-cols-2 gap-2 mb-4 border p-2 rounded">
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
        </div>

        {/* ÍTEMS */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">DETALLE DE COMPRA</h3>
        <table className="w-full text-[9px] border border-collapse mb-3">
          <thead className="bg-gray-200 text-[9px]">
            <tr>
              <th className="border p-1">#</th>
              <th className="border p-1">Descripción</th>
              <th className="border p-1">Cantidad</th>
              <th className="border p-1">P. Unit</th>
              <th className="border p-1">Descuento</th>
              <th className="border p-1">Neto</th>
              <th className="border p-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {oc.items.map((item, i) => {
              const neto = item.precioUnitario - item.descuento;
              const totalItem = neto * item.cantidad;
              return (
                <tr key={i} className="text-center">
                  <td className="border p-1">{i + 1}</td>
                  <td className="border p-1">{item.nombre}</td>
                  <td className="border p-1">{item.cantidad}</td>
                  <td className="border p-1">{formatearMoneda(item.precioUnitario, simbolo)}</td>
                  <td className="border p-1">{formatearMoneda(item.descuento, simbolo)}</td>
                  <td className="border p-1">{formatearMoneda(neto, simbolo)}</td>
                  <td className="border p-1">{formatearMoneda(totalItem, simbolo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* TOTALES */}
        <h3 className="text-right text-sm font-semibold mb-1 text-blue-900">RESUMEN</h3>
        <div className="text-right mb-4 pr-2">
          <p><strong>Subtotal:</strong> {formatearMoneda(subtotal, simbolo)}</p>
          <p><strong>IGV (18%):</strong> {formatearMoneda(igv, simbolo)}</p>
          <p><strong>Otros:</strong> {formatearMoneda(otros, simbolo)}</p>
          <p className="text-sm font-bold mt-1"><strong>Total:</strong> {formatearMoneda(total, simbolo)}</p>
        </div>

        {/* CONDICIONES DE ENTREGA */}
        <h3 className="text-sm font-semibold mb-1 text-blue-900">CONDICIONES DE ENTREGA</h3>
        <div className="grid grid-cols-2 gap-2 mb-4 border p-2 rounded">
          <div><span className="font-semibold">Lugar de entrega:</span><p>{oc.lugarEntrega}</p></div>
          <div><span className="font-semibold">Fecha de entrega:</span><p>{oc.fechaEntrega}</p></div>
          <div><span className="font-semibold">Condición de pago:</span><p>{oc.condicionPago}</p></div>
          <div><span className="font-semibold">Observaciones:</span><p>{oc.observaciones || "—"}</p></div>
        </div>

        {/* FIRMAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mt-12 text-sm">
          <div>
            <p className="border-t border-gray-600 pt-2 font-semibold">{oc.comprador}</p>
            <p>Solicitante / Comprador</p>
          </div>
          <div>
            {oc.firmaOperaciones ? (
              <>
                <p className="font-semibold">Aprobado por Operaciones</p>
                <img src={oc.firmaOperaciones} alt="Firma Operaciones" className="h-20 mx-auto mt-1" />
              </>
            ) : (
              <>
                <p className="border-t border-gray-600 pt-2 font-semibold">______________________</p>
                <p>Operaciones</p>
              </>
            )}
          </div>
          <div>
            {oc.firmaGerencia ? (
              <>
                <p className="font-semibold">Aprobado por Gerencia</p>
                <img src={oc.firmaGerencia} alt="Firma Gerencia" className="h-20 mx-auto mt-1" />
              </>
            ) : (
              <>
                <p className="border-t border-gray-600 pt-2 font-semibold">______________________</p>
                <p>Gerencia</p>
              </>
            )}
          </div>
        </div>

        {/* PIE DE DOCUMENTO */}
        <div className="mt-4 text-[8px] leading-snug text-gray-700 border-t pt-2">
          <p className="mb-1 font-semibold">ENVIAR SU COMPROBANTE CON COPIA A LOS SIGUIENTES CORREOS:</p>
          <ul className="list-disc pl-4">
            <li>FACTURAS ELECTRÓNICAS: jaliaga@memphis.pe | dmendez@memphis.pe | facturacion@memphis.pe | gomontero@memphis.pe</li>
            <li>CONSULTA DE PAGOS: jaliaga@memphis.pe | dmendez@memphis.pe | facturacion@memphis.pe</li>
          </ul>
          <p className="mt-1 text-justify italic">
            El presente servicio o producto cumple con los lineamientos de nuestro Sistema de Gestión Antisoborno.
            De no ser así, usar los canales de denuncia correspondientes.
          </p>
        </div>
      </div>

      {/* BOTONES */}
      <div className="mt-4 flex gap-4">
        {puedeExportar && (
          <button
            onClick={exportarPDF}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Exportar como PDF
          </button>
        )}

        {puedeFirmar && (
          <button
            onClick={() => navigate(`/firmar?id=${oc.id}`)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Aprobar / Rechazar OC
          </button>
        )}
      </div>
    </div>
  );
};

export default VerOC;
