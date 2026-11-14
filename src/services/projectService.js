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
  imageUrl: g.thumbnail || '',
  researchPaperLink: g.researchPaperLink || g.proposalLink || '',
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


/**
 * Converts an image File into a Base64 data URL.
 */
function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error('Failed to read the selected image.')
    );

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads the authenticated student's project thumbnail.
 */
export async function uploadProjectThumbnail(file) {
  if (!file) {
    throw new Error('Please select an image first.');
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPG, PNG, and WebP images are allowed.');
  }

  const MAX_SIZE = 2 * 1024 * 1024;

  if (file.size > MAX_SIZE) {
    throw new Error('Image size must not exceed 2 MB.');
  }

  const imageData = await convertImageToBase64(file);

  const response = await request('uploadThumbnail', {
    method: 'POST',
    authenticated: true,
    body: {
      imageData
    }
  });

  if (!response.thumbnail) {
    throw new Error('The server did not return the uploaded thumbnail URL.');
  }

  // Invalidate cached project data after successful upload.
  cachedProjects = undefined;
  projectsCachedAt = 0;
  projectsRevision += 1;
  projectsRequest = null;

  return response.thumbnail;
}

export async function deleteProjectThumbnail() {
  const response = await request('deleteThumbnail', {
    method: 'POST',
    authenticated: true,
  });

  if (response.thumbnail !== null) {
    throw new Error('The server did not confirm thumbnail deletion.');
  }

  cachedProjects = undefined;
  projectsCachedAt = 0;
  projectsRevision += 1;
  projectsRequest = null;
}
