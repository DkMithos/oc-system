// ✅ App.jsx
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AppRoutes from "./routes/AppRoutes";
import Login from "./pages/Login";
import { useUsuario } from "./context/UsuarioContext";
import { AppLoader } from "./components/ui/Skeleton";

function App() {
  const { usuario, cargando } = useUsuario();

  if (cargando) return <AppLoader />;

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
