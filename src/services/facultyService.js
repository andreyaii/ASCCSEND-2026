import { faculty } from '../data/faculty';
import { delay } from './mockStore';
import { getProjects } from './projectService';
import { getCurrentUser } from './authService';

export async function getFacultyById(id) {
  await delay(50);
  return faculty.find((f) => f.id === id) || null;
}

// Groups assigned to a faculty member (used by My Teams and evaluation eligibility).
export async function getAssignedGroupIds(facultyId) {
  const currentUser = getCurrentUser();
  const searchId = String(facultyId || currentUser?.id || currentUser?.facultyId || '').trim().toLowerCase();
  const searchName = String(currentUser?.name || '').trim().toLowerCase();

  try {
    const projects = await getProjects();
    const matching = projects.filter((p) => {
      const fId = String(p.facultyId || '').trim().toLowerCase();
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
