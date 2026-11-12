export function getProjectLogoUrl(project) {
  const resource = project?.imageUrl || project?.thumbnail;
  if (!resource) return '';

  try {
    const url = new URL(resource);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}
