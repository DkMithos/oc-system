import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Logo_Login.png";

const Login = ({ setUserRole }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      let role = "comprador";
      if (normalizedEmail === "mchuman@memphis.pe") role = "operaciones";
      else if (normalizedEmail === "gmacher@memphis.pe") role = "gerencia";
      else if (normalizedEmail === "kcastillo@memphis.pe") role = "admin";
      else if (normalizedEmail === "gomontero@memphis.pe") role = "comprador";
      else if (normalizedEmail === "admin@memphis.pe") role = "admin";
      else if (normalizedEmail === "jaliaga@memphis.pe") role = "finanzas";
      else if (normalizedEmail === "dmendez@memphis.pe") role = "finanzas";

      localStorage.setItem("userRole", role);
      localStorage.setItem("userEmail", normalizedEmail);
      setUserRole(role);
      navigate("/");
    } catch (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-md p-8 rounded-md w-full max-w-sm border border-gray-200"
      >
        <div className="flex justify-center mb-6">
          <img src={logo} alt="Logo Memphis" className="w-40" />
        </div>
        <h2 className="text-center text-xl font-semibold text-[#5f5f5f] mb-4">
          Iniciar Sesión
        </h2>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          required
        />
        <button
          type="submit"
          className="bg-[#fbc102] hover:bg-yellow-400 text-white font-semibold py-2 rounded w-full"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
};

export default Login;




