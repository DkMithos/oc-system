// src/components/ui/BackButton.jsx
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BackButton = ({ className = "" }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className={`p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-black transition-colors flex-shrink-0 ${className}`}
      aria-label="Volver atrás"
      title="Volver atrás"
    >
      <ArrowLeft size={20} />
    </button>
  );
};

export default BackButton;
