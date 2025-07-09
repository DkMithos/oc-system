// src/components/admin/ResumenCards.jsx
import React from "react";
import { FileText, BadgeCheck, Store } from "lucide-react";

const ResumenCards = ({ ordenes = [], cotizaciones = [], proveedores = [] }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-white shadow p-4 rounded text-center">
        <FileText className="mx-auto mb-2 text-blue-600" />
        <p className="text-gray-500">Órdenes de Compra</p>
        <p className="text-2xl font-bold">{ordenes.length}</p>
      </div>
      <div className="bg-white shadow p-4 rounded text-center">
        <BadgeCheck className="mx-auto mb-2 text-green-600" />
        <p className="text-gray-500">Cotizaciones</p>
        <p className="text-2xl font-bold">{cotizaciones.length}</p>
      </div>
      <div className="bg-white shadow p-4 rounded text-center">
        <Store className="mx-auto mb-2 text-yellow-600" />
        <p className="text-gray-500">Proveedores</p>
        <p className="text-2xl font-bold">{proveedores.length}</p>
      </div>
    </div>
  );
};

export default ResumenCards;
