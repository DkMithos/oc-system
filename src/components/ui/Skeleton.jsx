// src/components/ui/Skeleton.jsx
// Componente de placeholder animado para estados de carga

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className="bg-white rounded shadow p-4 space-y-3">
    <Skeleton className="h-4 w-1/3" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded shadow overflow-hidden">
    <div className="bg-gray-100 p-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="border-t p-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonKPI = ({ count = 4 }) => (
  <div className={`grid grid-cols-2 md:grid-cols-${Math.min(count, 4)} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded shadow p-4 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-2/3" />
      </div>
    ))}
  </div>
);

export default Skeleton;
