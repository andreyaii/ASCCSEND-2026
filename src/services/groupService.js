import { groups } from '../data/groups';
import { students } from '../data/students';
import { faculty } from '../data/faculty';
import { delay } from './mockStore';

const withMembers = (g) => ({
  ...g,
  members: g.memberIds.map((id) => students.find((s) => s.id === id)).filter(Boolean),
  advisers: g.adviserIds.map((id) => faculty.find((f) => f.id === id)).filter(Boolean),
});

export async function getGroups() {
  await delay();
  return groups.map(withMembers);
}

export async function getGroupById(id) {
  await delay();
  const g = groups.find((x) => x.id === id);
  return g ? withMembers(g) : null;
}
