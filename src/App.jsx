// ✅ App.jsx
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AppRoutes from "./routes/AppRoutes";
import Login from "./pages/Login";
import { useUsuario } from "./context/UsuarioContext";

function App() {
  const { usuario, cargando } = useUsuario();

  if (cargando) return <div className="p-6">Cargando sesión...</div>;

  return (
    <>
      <ToastContainer />
      {usuario?.rol ? (
        <AppRoutes userRole={usuario.rol} />
      ) : (
        <Login />
      )}
    </>
  );
}

export default App;
