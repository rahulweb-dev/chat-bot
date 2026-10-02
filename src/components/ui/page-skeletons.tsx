import { Skeleton } from "@/components/ui/skeleton";

// Shared, content-shaped loading placeholders. Each one mirrors the real
// layout it stands in for (stat row, table, kanban, chat thread, etc.) so
// the page doesn't jump/reflow once data arrives, and visitors don't read a
// "0" or "—" fallback as a real (empty) value while a query is still in
// flight.

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-white p-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6, cardClassName = "h-40" }: { count?: number; cardClassName?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cardClassName} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="flex gap-4 px-4 py-3 border-b bg-gray-50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 flex-1 ${c === 0 ? "max-w-[160px]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListRowsSkeleton({ rows = 5, withAvatar = true }: { rows?: number; withAvatar?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border bg-white p-3.5">
          {withAvatar && <Skeleton className="h-9 w-9 rounded-full shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <Skeleton className="h-3 w-32 mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {[58, 72, 46, 84, 100, 63, 38].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton({ columns = 5, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="shrink-0 w-64 space-y-2">
          <Skeleton className="h-8 w-full rounded-t-lg rounded-b-none" />
          <div className="min-h-[140px] bg-gray-50 rounded-b-lg border border-t-0 p-2 space-y-2">
            {Array.from({ length: cardsPerColumn }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="rounded-xl border bg-white p-6 space-y-5">
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

export function ChatThreadSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 border-r space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 p-5 space-y-4">
        <div className="flex gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-12 w-64 rounded-2xl" />
        </div>
        <div className="flex gap-2.5 justify-end">
          <Skeleton className="h-10 w-48 rounded-2xl" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-16 w-80 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
