// ✅ src/pages/Tickets.jsx
import React, { useEffect, useState } from "react";
import { PageLoader } from "../components/ui/Skeleton";
import {
  crearTicket,
  listarMisTickets,
  subirAdjuntoTicket,
  anexarAdjuntoTicket,
  DEFAULT_AGENT,
} from "../firebase/ticketsHelpers";
import TicketChat from "../components/TicketChat";
import { useUsuario } from "../context/UsuarioContext";
import { toast } from "react-toastify";
import BackButton from "../components/ui/BackButton";

// 🏷️ Categorías y regla de prioridad automática
const CATEGORIAS = [
  { value: "acceso", label: "Acceso/Bloqueo" },
  { value: "error_critico", label: "Error crítico" },
  { value: "compras_oc", label: "Compras / OC" },
  { value: "caja_chica", label: "Caja chica" },
  { value: "notificaciones", label: "Notificaciones" },
  { value: "mejora", label: "Mejora / Idea" },
  { value: "otros", label: "Otros" },
];

const prioridadPorCategoria = (value) => {
  switch (value) {
    case "error_critico":
      return "crítica";
    case "acceso":
    case "compras_oc":
      return "alta";
    case "caja_chica":
    case "notificaciones":
      return "media";
    case "mejora":
      return "baja";
    default:
      return "media";
  }
};

const infoSoporte = {
  correo: "soporte@memphis.pe",
  horario: "Lunes a viernes de 8:00 a 17:00",
  telefono: "+51 975 453 192",
};

const Tickets = () => {
  const { usuario, cargando: loading } = useUsuario();
  const [misTickets, setMisTickets] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    asunto: "",
    descripcion: "",
    categoria: "otros",
    archivo: null,
  });

  const cargar = async () => {
    if (!usuario?.email) return;
    const lista = await listarMisTickets((usuario.email || "").toLowerCase());
    setMisTickets(lista);
    if (!seleccionado && lista.length) setSeleccionado(lista[0]);
  };

  useEffect(() => {
    if (!loading) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const crear = async () => {
    if (!form.asunto.trim() || !form.descripcion.trim()) {
      toast.warn("Asunto y descripción son obligatorios");
      return;
    }
    if (guardando) return;

    setGuardando(true);
    const prioridad = prioridadPorCategoria(form.categoria);

    let ticketId = null;

    try {
      // 1) Crear ticket (si esto falla, mostramos error UNA sola vez)
      ticketId = await crearTicket({
        asunto: form.asunto,
        descripcion: form.descripcion,
        categoria: form.categoria,
        prioridad,
        creadoPor: {
          email: (usuario.email || "").toLowerCase(),
          nombre: usuario.nombre || usuario.email,
        },
        asignadoA: DEFAULT_AGENT, // asignación automática a Kevin
      });

      // 2) Adjuntar archivo (si falla, no mostramos error “de creación”, solo aviso)
      if (form.archivo) {
        try {
          const adj = await subirAdjuntoTicket(form.archivo, ticketId);
          await anexarAdjuntoTicket(ticketId, adj);
        } catch (eAdj) {
          console.error("Adjunto falló:", eAdj);
          toast.info("El ticket se creó, pero no se pudo subir el adjunto.");
        }
      }

      toast.success(`Ticket creado (#${ticketId.slice(-6)}) y asignado a ${DEFAULT_AGENT.nombre}`);

      // Reset UI
      setForm({ asunto: "", descripcion: "", categoria: "otros", archivo: null });

      // Recargar lista y seleccionar el nuevo ticket
      const lista = await listarMisTickets((usuario.email || "").toLowerCase());
      setMisTickets(lista);
      const nuevo = lista.find((t) => t.id === ticketId);
      setSeleccionado(nuevo || null);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear el ticket. Intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna izquierda: crear y listado */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center gap-2 mb-3">
            <BackButton />
            <h2 className="text-lg font-bold">Nuevo Ticket</h2>
          </div>
          <div className="space-y-2">
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400"
              placeholder="Asunto"
              value={form.asunto}
              onChange={(e) => setForm({ ...form, asunto: e.target.value })}
            />

            <select
              className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <textarea
              className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400"
              rows={4}
              placeholder="Describe el problema o solicitud"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />

            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <span className="text-black underline hover:font-semibold transition-all">Adjuntar archivo</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setForm({ ...form, archivo: e.target.files[0] })}
              />
              {form.archivo && (
                <span className="text-gray-600 truncate max-w-[220px]">
                  {form.archivo.name}
                </span>
              )}
            </label>

            <button
              onClick={crear}
              disabled={guardando}
              className={`px-4 py-2 rounded-lg w-full font-semibold transition-colors ${
                guardando ? "bg-[#f0c000]/60 text-black cursor-not-allowed" : "bg-[#f0c000] hover:bg-[#d4a800] text-black"
              }`}
            >
              {guardando ? "Creando…" : "Crear ticket"}
            </button>

            <p className="text-[11px] text-gray-500">
              Este ticket se asignará automáticamente a <b>{DEFAULT_AGENT.nombre}</b>.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-3">Mis tickets</h2>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {misTickets.length === 0 ? (
              <div className="text-sm text-gray-500">Aún no tienes tickets.</div>
            ) : (
              misTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSeleccionado(t)}
                  className={`w-full text-left p-2 rounded border hover:bg-gray-50 ${
                    seleccionado?.id === t.id ? "border-black" : "border-gray-200"
                  }`}
                >
                  <div className="font-semibold text-sm">{t.asunto}</div>
                  <div className="text-xs text-gray-500">
                    {t.categoria?.replace("_", " ")} • {t.prioridad?.toUpperCase()} •{" "}
                    {t.estado?.replace("_", " ")}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow text-sm">
          <h3 className="font-bold mb-2">Contacto de Soporte</h3>
          <p>
            <strong>Correo:</strong> {infoSoporte.correo}
          </p>
          <p>
            <strong>Horario:</strong> {infoSoporte.horario}
          </p>
          <p>
            <strong>Teléfono:</strong> {infoSoporte.telefono}
          </p>
        </div>
      </div>

      {/* Columna derecha: detalle */}
      <div className="lg:col-span-2">
        {!seleccionado ? (
          <div className="bg-white p-6 rounded shadow text-gray-500">
            Selecciona un ticket para ver el detalle y conversar con soporte.
          </div>
        ) : (
          <div className="bg-white p-6 rounded shadow space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{seleccionado.asunto}</h2>
                <div className="text-sm text-gray-600">
                  {seleccionado.categoria?.replace("_", " ")} •{" "}
                  {seleccionado.prioridad?.toUpperCase()} •{" "}
                  {seleccionado.estado?.replace("_", " ")}
                </div>
                <div className="text-xs text-gray-500">
                  Asignado a:{" "}
                  {seleccionado.asignadoA?.nombre ||
                    seleccionado.asignadoA?.email ||
                    "—"}
                </div>
              </div>
            </div>

            <p className="text-sm whitespace-pre-line">{seleccionado.descripcion}</p>

            {!!(seleccionado.adjuntos?.length) && (
              <div className="text-sm">
                <h4 className="font-semibold mb-1">Adjuntos</h4>
                <ul className="list-disc ml-5">
                  {seleccionado.adjuntos.map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <a
                        className="text-black underline hover:font-semibold transition-all"
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.nombre || "Archivo"}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <TicketChat ticketId={seleccionado.id} usuario={usuario} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Tickets;
