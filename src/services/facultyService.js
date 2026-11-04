import { faculty } from '../data/faculty';
import { delay } from './mockStore';

export async function getFacultyById(id) {
  await delay(50);
  return faculty.find((f) => f.id === id) || null;
}

// Groups assigned to a faculty member (used by My Teams).
export async function getAssignedGroupIds(facultyId) {
  await delay(50);
  return faculty.find((f) => f.id === facultyId)?.assignedGroupIds ?? [];
}
