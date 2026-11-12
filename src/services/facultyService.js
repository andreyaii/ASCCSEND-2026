import { faculty } from '../data/faculty';
import { delay } from './mockStore';
import { getProjects } from './projectService';
import { getCurrentUser } from './authService';
import { normalizeIdentity } from '../utils/faculty.js';

export async function getFacultyById(id) {
  await delay(50);
  return faculty.find((f) => f.id === id) || null;
}

// Groups assigned to a faculty member (used by My Teams and evaluation eligibility).
export async function getAssignedGroupIds(facultyId) {
  const currentUser = getCurrentUser();
  const searchId = normalizeIdentity(facultyId || currentUser?.id || currentUser?.facultyId);
  const searchName = normalizeIdentity(currentUser?.name);

  try {
    const projects = await getProjects();
    const matching = projects.filter((p) => {
      const fId = normalizeIdentity(p.facultyId);
      return fId && (fId === searchId || fId === searchName);
    });
    const fromProjects = matching.map((p) => p.groupId);
    if (fromProjects.length > 0) return fromProjects;
  } catch {
    // If project fetch fails, fall through to faculty mock list
  }

  await delay(50);
  return faculty.find((f) => f.id === facultyId || f.facultyId === facultyId)?.assignedGroupIds ?? [];
}
