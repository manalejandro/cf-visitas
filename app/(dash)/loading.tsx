export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-9 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="panel h-[122px] p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-8 w-20" />
            <div className="skeleton mt-4 h-8 w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="panel h-[360px] xl:col-span-2" />
        <div className="panel h-[360px]" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel h-[260px]" />
        ))}
      </div>
    </div>
  );
}
