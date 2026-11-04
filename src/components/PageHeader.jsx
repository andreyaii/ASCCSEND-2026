export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="text-2xl font-bold leading-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
