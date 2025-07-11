import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import Login from "./pages/Login";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [userRole, setUserRole] = useState(localStorage.getItem("userRole"));

  useEffect(() => {
    const savedRole = localStorage.getItem("userRole");
    if (savedRole) setUserRole(savedRole);
  }, []);

  return (
    <>
      <ToastContainer />
      <Routes>
        {!userRole ? (
          <Route path="*" element={<Login setUserRole={setUserRole} />} />
        ) : (
          <Route path="*" element={<AppRoutes userRole={userRole} />} />
        )}
      </Routes>
    </>
  );
}

export default App;
