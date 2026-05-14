// ✅ src/pages/Login.jsx
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import logo from "../assets/Logo_Login.png";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      // Validar que el usuario tenga un rol en Firestore
      const userDocRef = doc(db, "usuarios", normalizedEmail);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setError("Tu cuenta no tiene un rol asignado. Contacta al administrador.");
        setCargando(false);
        return;
      }

      localStorage.setItem("userEmail", normalizedEmail);

      // ✅ El UsuarioContext se actualizará automáticamente por `onAuthStateChanged`
      navigate("/");
    } catch {
      // [SEGURIDAD] Mensaje genérico — evita enumeración de usuarios
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setCargando(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#004990] px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-xl p-8 rounded-lg w-full max-w-md border border-gray-200"
      >
        <div className="flex justify-center mb-6">
          <img src={logo} alt="Logo Memphis" className="w-48" />
        </div>
        <h2 className="text-center text-xl font-bold text-gray-800 mb-4">
          Iniciar Sesión
        </h2>

        {/* Mensaje de error inline */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          required
        />
        <div className="relative mb-4">
          <input
            type={mostrarPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            className="w-full p-2 pr-10 border rounded focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
            required
          />
          <button
            type="button"
            onClick={() => setMostrarPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
            aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={cargando}
          className="bg-[#fbc102] hover:bg-yellow-400 text-[#004990] font-semibold py-2 rounded w-full transition-all
                     disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {cargando ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#004990]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Verificando...
            </>
          ) : (
            "Ingresar"
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;
