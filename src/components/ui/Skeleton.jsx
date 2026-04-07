// src/components/ui/Skeleton.jsx
// Placeholders animados para estados de carga

/* ── Base shimmer ─────────────────────────────────────────── */
const Skeleton = ({ className = "" }) => (
  <div
    className={`relative overflow-hidden bg-gray-200 rounded ${className}`}
    aria-hidden="true"
  >
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
  </div>
);

/* ── Card skeleton ────────────────────────────────────────── */
export const SkeletonCard = ({ lines = 3 }) => (
  <div className="bg-white rounded shadow p-4 space-y-3">
    <Skeleton className="h-4 w-1/3" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
    ))}
  </div>
);

/* ── Table skeleton ───────────────────────────────────────── */
export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded shadow overflow-hidden">
    <div
      className="bg-gray-100 p-2 grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="border-t p-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3" />
        ))}
      </div>
    ))}
  </div>
);

/* ── KPI skeleton (fix: usa style en lugar de clase dinámica) */
export const SkeletonKPI = ({ count = 4 }) => (
  <div
    className="grid grid-cols-2 gap-4"
    style={{ gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))` }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded shadow p-4 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-2/3" />
      </div>
    ))}
  </div>
);

/* ── PageLoader — spinner centrado para páginas ───────────── */
export const PageLoader = ({ mensaje = "Cargando…" }) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 select-none">
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-full border-4 border-[#004990]/15" />
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#004990] animate-spin" />
    </div>
    <p className="text-sm text-gray-400">{mensaje}</p>
  </div>
);

/* ── AppLoader — pantalla completa al iniciar sesión ─────── */
export const AppLoader = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#012b5a] gap-6 select-none">
    {/* Logo + nombre */}
    <div className="flex flex-col items-center gap-3 animate-fadeInUp">
      <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center shadow-lg">
        <span className="text-[#012b5a] font-black text-2xl tracking-tight">M</span>
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-xl tracking-tight">Memphis ERP</p>
        <p className="text-white/40 text-xs mt-0.5">Sistema de Gestión</p>
      </div>
    </div>

    {/* Spinner */}
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-amber-400 animate-spin" />
    </div>

    {/* Dots animados */}
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/30 animate-dotPulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  </div>
);

export default Skeleton;
