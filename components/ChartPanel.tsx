export function ChartPanel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex min-w-0 flex-col ${className}`}>
      <header className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="flex-1 px-5 pb-5 pt-2">{children}</div>
    </section>
  );
}

export function EmptyHint({ label = "No data for this period" }: { label?: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-xs text-faint">
      {label}
    </div>
  );
}
