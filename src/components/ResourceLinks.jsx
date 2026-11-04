import { FileText, PlayCircle, BookOpen, ExternalLink } from 'lucide-react';

// Three separate resources: Proposal, Pitch Video, Documentation.
const items = [
  { key: 'proposalUrl', label: 'Proposal', icon: FileText },
  { key: 'pitchVideoUrl', label: 'Pitch Video', icon: PlayCircle },
  { key: 'documentationUrl', label: 'Documentation', icon: BookOpen },
];

export default function ResourceLinks({ project }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, label, icon: Icon }) => {
        let safeUrl = null;
        try {
          const parsed = new URL(project?.[key]);
          if (['http:', 'https:'].includes(parsed.protocol) && parsed.hostname && !parsed.username && !parsed.password) {
            safeUrl = parsed.href;
          }
        } catch {
          safeUrl = null;
        }
        return safeUrl ? (
          <a key={key} href={safeUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <Icon className="h-4 w-4" /> {label} <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        ) : (
          <span key={key} className="btn-secondary cursor-not-allowed opacity-50">
            <Icon className="h-4 w-4" /> {label} ({project?.[key] ? 'unavailable' : 'not submitted'})
          </span>
        );
      })}
    </div>
  );
}
