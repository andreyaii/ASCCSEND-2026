import { Link } from 'react-router-dom';
import ProjectThumb from './ProjectThumb';
import MemberList from './MemberList';
import ResourceLinks from './ResourceLinks';
import RatingSummary from './RatingSummary';

// Full group + project info. Used by My Group (student) and My Teams (faculty).
export default function GroupProjectPanel({ project, aggregate, detailsTo, showRating = true }) {
  return (
    <section className="card overflow-hidden">
      <div className="grid md:grid-cols-[280px_1fr]">
        <ProjectThumb project={project} className="md:h-full md:min-h-[300px] md:aspect-auto" />
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-1 text-xs font-semibold text-primary">{project.group?.groupName || 'Group information unavailable'}</p>
            <h2 className="text-xl font-bold leading-snug sm:text-2xl">{project.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{project.description}</p>
          </div>
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-bold">Team members</h3>
            <MemberList members={project.group.members} />
          </div>
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-bold">Project resources</h3>
            <ResourceLinks project={project} />
          </div>
          {showRating && <div className="border-t border-line pt-4"><h3 className="mb-2 text-sm font-bold">Rating</h3><RatingSummary aggregate={aggregate} variant="full" /></div>}
          {detailsTo && <Link to={detailsTo} className="btn-primary">View Project Details</Link>}
        </div>
      </div>
    </section>
  );
}
