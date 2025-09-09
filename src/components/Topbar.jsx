import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-navbar.png";
import Notificaciones from "./Notificaciones";

const Topbar = ({ toggleSidebar }) => {
  return (
    <header className="bg-blue-900 text-white shadow-md sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={toggleSidebar} className="focus:outline-none">
            <Menu size={24} />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Memphis Logo" className="h-10" />
            <h1 className="text-lg font-semibold">Sistema de Gestión Memphis</h1>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Notificaciones />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
