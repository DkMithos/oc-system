// src/components/ErrorBoundary.jsx
// [S1-6] Error Boundary global — captura errores de renderizado y evita pantalla blanca
import React from "react";
import { reportError } from "../utils/errorReporting";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    reportError(error, {
      source: "ErrorBoundary",
      componentStack: errorInfo?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-red-700 mb-2">
              Ocurrio un error inesperado
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error?.message || "Error desconocido en este modulo."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Reintentar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              >
                Recargar pagina
              </button>
            </div>
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mt-4 text-left text-xs text-gray-500 bg-gray-50 p-3 rounded border max-h-40 overflow-auto">
                <summary className="cursor-pointer font-medium">Stack trace (dev)</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
