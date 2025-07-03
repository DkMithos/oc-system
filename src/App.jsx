import { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import Login from "./pages/Login";

function App() {
  const [userRole, setUserRole] = useState(localStorage.getItem("userRole"));

  useEffect(() => {
    const savedRole = localStorage.getItem("userRole");
    if (savedRole) setUserRole(savedRole);
  }, []);

  return (
    <BrowserRouter>
      {userRole ? (
        <AppRoutes userRole={userRole} />
      ) : (
        <Login setUserRole={setUserRole} />
      )}
    </BrowserRouter>
  );
}

export default App;



