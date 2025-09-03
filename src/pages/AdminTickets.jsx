// ✅ src/pages/AdminTickets.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  asignarTicket, cambiarEstadoTicket, escucharTicket,
  listarTicketsAdmin
} from "../firebase/ticketsHelpers";
import TicketChat from "../components/TicketChat";
import { useUsuario } from "../context/UsuarioContext";

const AdminTickets = () => {
  const { usuario, loading } = useUsuario();
  const [tickets, setTickets] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtro, setFiltro] = useState({ estado: "", prioridad: "" });

  const cargar = async () => {
    const lista = await listarTicketsAdmin();
    setTickets(lista);
    if (lista.length && !seleccionado) setSeleccionado(lista[0]);
  };

  useEffect(() => { if (!loading) cargar(); /* eslint-disable-next-line */ }, [loading]);

  // Refresco en tiempo real del seleccionado
  useEffect(() => {
    if (!seleccionado?.id) return;
    const unsub = escucharTicket(seleccionado.id, (t) => setSeleccionado(t));
    return () => unsub && unsub();
  }, [seleccionado?.id]);

  const filtrados = useMemo(() => {
    return tickets.filter(t =>
      (filtro.estado ? t.estado === filtro.estado : true) &&
      (filtro.prioridad ? t.prioridad === filtro.prioridad : true)
    );
  }, [tickets, filtro]);

  const yo = { email: usuario?.email, nombre: usuario?.nombre || usuario?.email };

  const tomarTicket = async () => {
    if (!seleccionado) return;
    await asignarTicket(seleccionado.id, yo);
    await cargar();
  };

  const cambiarEstado = async (estado) => {
    if (!seleccionado) return;
    await cambiarEstadoTicket(seleccionado.id, estado);
    await cargar();
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!usuario || !["admin", "soporte"].includes(usuario.rol)) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-3">Tickets</h2>
          <div className="flex gap-2 mb-3">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filtro.estado}
              onChange={e => setFiltro(f => ({ ...f, estado: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="abierto">Abiertos</option>
              <option value="en_progreso">En progreso</option>
              <option value="resuelto">Resueltos</option>
              <option value="cerrado">Cerrados</option>
            </select>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filtro.prioridad}
              onChange={e => setFiltro(f => ({ ...f, prioridad: e.target.value }))}
            >
              <option value="">Cualquier prioridad</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="crítica">Crítica</option>
            </select>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {filtrados.map(t => (
              <button
                key={t.id}
                onClick={() => setSeleccionado(t)}
                className={`w-full text-left p-2 rounded border hover:bg-gray-50 ${
                  seleccionado?.id === t.id ? "border-blue-500" : "border-gray-200"
                }`}
              >
                <div className="flex justify-between">
                  <div className="font-semibold text-sm">{t.asunto}</div>
                  <div className="text-[11px] text-gray-500">{t.prioridad}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {t.creadoPor?.nombre || t.creadoPor?.email} • {t.estado.replace("_", " ")}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        {!seleccionado ? (
          <div className="bg-white p-6 rounded shadow text-gray-500">
            Selecciona un ticket para gestionarlo.
          </div>
        ) : (
          <div className="bg-white p-6 rounded shadow space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{seleccionado.asunto}</h2>
                <div className="text-sm text-gray-600">
                  {seleccionado.prioridad.toUpperCase()} • {seleccionado.estado.replace("_", " ")}
                </div>
                <div className="text-xs text-gray-500">
                  Reportado por: {seleccionado.creadoPor?.nombre || seleccionado.creadoPor?.email}
                </div>
              </div>
              <div className="flex gap-2">
                {!seleccionado.asignadoA && (
                  <button
                    onClick={tomarTicket}
                    className="bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 text-sm"
                  >
                    Tomar ticket
                  </button>
                )}
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={seleccionado.estado}
                  onChange={(e) => cambiarEstado(e.target.value)}
                >
                  <option value="abierto">Abierto</option>
                  <option value="en_progreso">En progreso</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
            </div>

            <p className="text-sm whitespace-pre-line">{seleccionado.descripcion}</p>

            {!!(seleccionado.adjuntos?.length) && (
              <div className="text-sm">
                <h4 className="font-semibold mb-1">Adjuntos del usuario</h4>
                <ul className="list-disc ml-5">
                  {seleccionado.adjuntos.map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <a className="text-blue-700 underline" href={a.url} target="_blank" rel="noreferrer">
                        {a.nombre || "Archivo"}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-sm">
              Asignado a:{" "}
              {seleccionado.asignadoA
                ? (seleccionado.asignadoA.nombre || seleccionado.asignadoA.email)
                : "—"}
            </div>

            <TicketChat ticketId={seleccionado.id} usuario={usuario} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTickets;
