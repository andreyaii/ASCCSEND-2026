export default function MemberList({ members = [] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-[10px] bg-surface px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
            {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{m.name}</span>
            <span className="block truncate text-xs text-muted">{m.studentId}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
