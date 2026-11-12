import { Link } from 'react-router-dom';
import ProjectThumb from './ProjectThumb';
import RatingSummary from './RatingSummary';

export default function ProjectCard({ project, to, aggregate, badge, fullCardLink = false }) {
  const card = (
    <article className="card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <ProjectThumb project={project} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-primary">{project.group?.groupName || 'Group information unavailable'}</p>
          {badge}
        </div>
        <h3 className="mb-2 line-clamp-2 text-base font-bold leading-snug group-hover:text-primary">{project.title}</h3>
        <p className="line-clamp-3 text-sm leading-6 text-muted">{project.description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <RatingSummary aggregate={aggregate} />
        {!fullCardLink && <Link to={to} className="btn-secondary min-h-9 px-3 py-1.5 text-xs">View project</Link>}
      </div>
    </article>
  );

  return fullCardLink ? (
    <Link to={to} className="block h-full text-inherit no-underline focus-visible:rounded-card">
      {card}
    </Link>
  ) : card;
}
