import React from "react";

const Footer = () => {
  return (
    <footer className="mt-auto bg-[#003865] text-white text-sm py-4 text-center">
      <p className="mb-1">Términos y condiciones aplicables.</p>
      <p>&copy; {new Date().getFullYear()} Memphis Maquinarias. Todos los derechos reservados.</p>
      <p className="text-[#fbc102] mt-1">Desarrollado por Kevin Castillo</p>
    </footer>
  );
};

export default Footer;
