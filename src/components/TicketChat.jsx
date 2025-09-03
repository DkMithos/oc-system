// ✅ src/components/TicketChat.jsx
import React, { useEffect, useRef, useState } from "react";
import { enviarMensajeTicket, escucharMensajesTicket } from "../firebase/ticketsHelpers";

const TicketChat = ({ ticketId, usuario }) => {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (!ticketId) return;
    const unsub = escucharMensajesTicket(ticketId, setMensajes);
    return () => unsub && unsub();
  }, [ticketId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    await enviarMensajeTicket(ticketId, {
      texto: texto.trim(),
      autor: { email: usuario.email, nombre: usuario.nombre || usuario.email, rol: usuario.rol },
    });
    setTexto("");
  };

  return (
    <div className="border rounded p-3 flex flex-col h-80">
      <div className="flex-1 overflow-y-auto space-y-2">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] p-2 rounded ${
              m.autor?.email === usuario.email ? "bg-blue-100 ml-auto" : "bg-gray-100"
            }`}
          >
            <div className="text-[11px] text-gray-500 mb-1">
              {m.autor?.nombre || m.autor?.email} {m.autor?.rol ? `• ${m.autor.rol}` : ""}
            </div>
            <div className="text-sm">{m.texto}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={enviar} className="mt-2 flex gap-2">
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="Escribe un mensaje…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700">Enviar</button>
      </form>
    </div>
  );
};

export default TicketChat;
