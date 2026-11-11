import { request } from '../config/apiConfig.js';

const PROJECT_CACHE_MS = 30_000;
let cachedProjects;
let projectsCachedAt = 0;
let projectsRequest;
let projectsRevision = 0;

/**
 * Hydrates a project/group object from the Google Sheets API response
 * so it matches the data shape expected by your UI components.
 */
const hydrate = (g) => ({
  id: g.groupCode,
  groupId: g.groupCode,
  groupCode: g.groupCode,
  title: g.title || 'Untitled Project',
  description: g.description || '',
  tag: g.tag || 'General',
  category: g.tag || 'General',
  stage: g.stage || 'Proposal',
  facultyId: g.facultyId || null,
  thumbnail: g.thumbnail || '',
  proposalLink: g.proposalLink || '',
  pitchVideoLink: g.pitchVideoLink || '',
  documentationLink: g.documentationLink || g.posterLink || '',
  posterLink: g.posterLink || g.documentationLink || '',
  group: {
    id: g.groupCode,
    groupCode: g.groupCode,
    groupName: g.title || g.groupCode,
    members: Array.isArray(g.members) ? g.members : []
  }
});

export async function getProjects({ excludeGroupId, groupIds, refresh = false } = {}) {
  if (refresh) {
    cachedProjects = undefined;
    projectsCachedAt = 0;
    projectsRevision += 1;
  }
  let projects;
  if (!cachedProjects || Date.now() - projectsCachedAt >= PROJECT_CACHE_MS) {
    if (!projectsRequest || refresh) {
      const requestRevision = projectsRevision;
      const currentRequest = request('getProjects', { deduplicate: !refresh })
        .then((response) => {
          if (!Array.isArray(response.data)) throw new Error('Project list response is invalid.');
          const projects = response.data.map(hydrate);
          if (requestRevision === projectsRevision) {
            cachedProjects = projects;
            projectsCachedAt = Date.now();
          }
          return projects;
        })
        .finally(() => {
          if (projectsRequest === currentRequest) projectsRequest = null;
        });
      projectsRequest = currentRequest;
    }
    projects = await projectsRequest;
  } else {
    projects = cachedProjects;
  }

  return projects
    .filter((p) => p.groupId !== excludeGroupId)
    .filter((p) => !groupIds || groupIds.includes(p.groupId));
}

export async function getProjectById(id, options) {
  const projects = await getProjects(options);
  return projects.find((x) => x.id === id || x.groupId === id) || null;
}

export async function getProjectByGroupId(groupId, options) {
  const normalizeGroupId = (value) => String(value || '').trim().replace(/\s+/g, '').toUpperCase();
  const normalizedGroupId = normalizeGroupId(groupId);
  if (!normalizedGroupId) return null;

  const projects = await getProjects(options);
  return projects.find((project) => normalizeGroupId(project.groupId) === normalizedGroupId) || null;
}

export async function getCategories() {
  const projects = await getProjects();
  const categories = projects.map((p) => p.category).filter(Boolean);
  return [...new Set(categories)].sort();
}