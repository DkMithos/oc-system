// src/components/ui/card.jsx
import React from "react";

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded shadow p-4 ${className}`}>{children}</div>
);

export const CardContent = ({ children }) => (
  <div className="text-sm text-gray-700">{children}</div>
);
