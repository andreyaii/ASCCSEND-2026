import { FileText, PlayCircle, BookOpen, ExternalLink, Image } from 'lucide-react';
import { getProjectLogoUrl } from '../utils/projectLogo';

// Three separate resources: Proposal, Pitch Video, Documentation.
const items = [
  { key: 'proposalLink', legacyKey: 'proposalUrl', label: 'Proposal', icon: FileText },
  { key: 'pitchVideoLink', legacyKey: 'pitchVideoUrl', label: 'Pitch Video', icon: PlayCircle },
  { key: 'documentationLink', legacyKey: 'documentationUrl', label: 'Poster', icon: BookOpen },
];

export default function ResourceLinks({ project, onLogoClick }) {
  const logoUrl = getProjectLogoUrl(project);

  return (
    <div className="flex flex-wrap gap-2">
      {logoUrl && onLogoClick && (
        <button type="button" onClick={() => onLogoClick(logoUrl)} className="btn-secondary">
          <Image className="h-4 w-4" /> Project logo
        </button>
      )}
      {items.map(({ key, legacyKey, label, icon: Icon }) => {
        const resource = project?.[key] || project?.[legacyKey];
        let safeUrl = null;
        try {
          const parsed = new URL(resource);
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
            <Icon className="h-4 w-4" /> {label} ({resource ? 'unavailable' : 'not submitted'})
          </span>
        );
      })}
    </div>
  );
}
