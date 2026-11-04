import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import ProjectCard from './ProjectCard';
import { EmptyState } from './Feedback';
import { useSettings } from '../context/SettingsContext';
import { getCategories } from '../services/projectService';

// Search + category filter + sort over project cards. Shared by Explore and All Projects.
export default function ProjectBrowser({ projects, aggregates = {}, linkFor, badgeFor }) {
  const { ratingsShown } = useSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('default');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter((p) =>
      (category === 'all' || p.category === category) &&
      (!q || [p.title, p.description, p.category, p.group?.groupName].some((f) => String(f || '').toLowerCase().includes(q))));
    const sorters = {
      default: () => 0,
      'title-asc': (a, b) => a.title.localeCompare(b.title),
      'title-desc': (a, b) => b.title.localeCompare(a.title),
      'top-rated': (a, b) => (aggregates[b.groupId]?.average ?? 0) - (aggregates[a.groupId]?.average ?? 0),
    };
    return [...list].sort(sorters[sort === 'top-rated' && !ratingsShown ? 'default' : sort]);
  }, [projects, aggregates, query, category, sort, ratingsShown]);

  return (
    <>
      <section className="mb-5 rounded-card border border-line bg-white p-3 sm:p-4" aria-label="Project filters">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <SlidersHorizontal className="h-4 w-4" /> Discover projects
          <span className="ml-auto normal-case tracking-normal">{visible.length} {visible.length === 1 ? 'project' : 'projects'}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="form-input pl-9" placeholder="Search title, description, category, or group" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search projects" />
        </div>
        <select className="form-input min-w-0 sm:w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="all">All Categories</option>
          {getCategories().map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input min-w-0 sm:w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects">
          <option value="default">Group order</option>
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          {ratingsShown && <option value="top-rated">Top rated</option>}
        </select>
      </div>
      </section>

      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 ? (
          <EmptyState title="No projects found" message="Try a different search term or category." />
        ) : visible.map((p) => (
          <ProjectCard key={p.id} project={p} to={linkFor(p)} aggregate={aggregates[p.groupId]} badge={badgeFor?.(p)} />
        ))}
      </div>
    </>
  );
}
