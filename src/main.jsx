import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { UsuarioProvider } from "./context/UsuarioContext";
import { PendientesProvider } from "./context/PendientesContext";

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { initErrorReporting } from "./utils/errorReporting";

// Fase 8: Captura global de errores no manejados
initErrorReporting();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <UsuarioProvider>
        <PendientesProvider>
          <App />
        </PendientesProvider>
      </UsuarioProvider>
    </BrowserRouter>
  </React.StrictMode>
);
