import { getProjects } from './projectService';
import { getCurrentUser } from './authService';
import { normalizeIdentity } from '../utils/faculty.js';

// Groups assigned to a faculty member (used by My Teams and evaluation eligibility).
export async function getAssignedGroupIds(facultyId) {
  const currentUser = getCurrentUser();
  const searchId = normalizeIdentity(facultyId || currentUser?.facultyId || currentUser?.id);
  const searchName = normalizeIdentity(currentUser?.name);
  const projects = await getProjects();
  return projects
    .filter((project) => {
      const assignedFaculty = normalizeIdentity(project.facultyId);
      return assignedFaculty && (assignedFaculty === searchId || assignedFaculty === searchName);
    })
    .map((project) => project.groupId);
}
