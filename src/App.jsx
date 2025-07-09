import { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
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
    <BrowserRouter>
      <ToastContainer />
      {userRole ? <AppRoutes userRole={userRole} /> : <Login setUserRole={setUserRole} />}
    </BrowserRouter>
  );
}

export default App;
