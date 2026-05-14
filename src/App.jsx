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
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
      {usuario?.rol ? (
        <AppRoutes userRole={usuario.rol} />
      ) : (
        <Login />
      )}
    </>
  );
}

export default App;
