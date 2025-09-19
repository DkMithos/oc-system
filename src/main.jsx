import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { UsuarioProvider } from "./context/UsuarioContext";
import { PendientesProvider } from "./context/PendientesContext";

import "@fontsource/roboto";

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
