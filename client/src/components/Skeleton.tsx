interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({ width = '100%', height = '16px', radius = 'var(--radius-sm)', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <Skeleton width="40%" height="10px" />
      <div className="skeleton-card-body">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height="14px" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="skeleton-row" aria-hidden="true">
      <Skeleton width="36px" height="36px" radius="50%" />
      <div className="skeleton-row-text">
        <Skeleton width="50%" height="13px" />
        <Skeleton width="80%" height="11px" />
      </div>
    </div>
  )
}

export function SkeletonRing() {
  return (
    <div className="skeleton-ring-wrap" aria-hidden="true">
      <Skeleton width="80px" height="80px" radius="50%" />
      <div className="skeleton-ring-text">
        <Skeleton width="60%" height="14px" />
        <Skeleton width="40%" height="11px" />
      </div>
    </div>
  )
}
