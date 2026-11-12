import { FolderKanban } from 'lucide-react';

export default function ProjectThumb({ project, className = '' }) {
  const imageUrl = project.imageUrl || project.thumbnail;
  return (
    <div className={`project-thumb-placeholder relative aspect-video w-full overflow-hidden bg-primary-light ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={project.title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-primary/50">
          <FolderKanban className="h-10 w-10" aria-hidden="true" />
          <span className="text-xs font-medium text-primary/70">Project preview unavailable</span>
        </div>
      )}
      {project.category && <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-20px)] truncate rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink shadow-card">
        {project.category}
      </span>}
    </div>
  );
}
