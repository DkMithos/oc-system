// src/components/Topbar.jsx
import { Menu } from "lucide-react";
import logo from "../assets/logo-navbar.png"; // Usa tu PNG sin fondo

const Topbar = ({ toggleSidebar }) => {
  return (
    <header className="bg-blue-900 text-white flex items-center justify-between px-4 py-3 shadow-md sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <button onClick={toggleSidebar} className="focus:outline-none">
          <Menu size={24} />
        </button>
        <img src={logo} alt="Memphis Logo" className="h-10" />
        <h1 className="text-lg font-semibold">Gestión de OC</h1>
      </div>
    </header>
  );
};

export default Topbar;
