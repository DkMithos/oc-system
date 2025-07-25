// ✅ src/pages/Login.jsx
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import logo from "../assets/Logo_Login.png";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      // Validar que el usuario tenga un rol en Firestore
      const userDocRef = doc(db, "usuarios", normalizedEmail);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        alert("Tu cuenta no tiene un rol asignado. Contacta al administrador.");
        return;
      }

      // Si existe, se guarda en localStorage como caché temporal
      const userData = userDoc.data();
      const { rol } = userData;

      localStorage.setItem("userRole", rol); // ya no es crítico, pero sigue siendo útil
      localStorage.setItem("userEmail", normalizedEmail);

      // ✅ El UsuarioContext se actualizará automáticamente por `onAuthStateChanged`
      navigate("/");
    } catch (error) {
      alert("Error al iniciar sesión: " + error.message);
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
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          required
        />
        <button
          type="submit"
          className="bg-[#fbc102] hover:bg-yellow-400 text-[#004990] font-semibold py-2 rounded w-full transition-all"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
};

export default Login;
