import { projects } from '../data/projects';
import { groups } from '../data/groups';
import { students } from '../data/students';
import { delay } from './mockStore';

// Project + its group (with resolved members).
const hydrate = (p) => {
  const g = groups.find((x) => x.id === p.groupId);
  return {
    ...p,
    group: g
      ? { ...g, members: (g.memberIds || []).map((id) => students.find((s) => s.id === id)).filter(Boolean) }
      : { id: p.groupId, groupName: 'Group information unavailable', members: [] },
  };
};

export async function getProjects({ excludeGroupId, groupIds } = {}) {
  await delay();
  return projects
    .filter((p) => p.groupId !== excludeGroupId)
    .filter((p) => !groupIds || groupIds.includes(p.groupId))
    .map(hydrate);
}

export async function getProjectById(id) {
  await delay();
  const p = projects.find((x) => x.id === id);
  return p ? hydrate(p) : null;
}

export async function getProjectByGroupId(groupId) {
  await delay();
  const p = projects.find((x) => x.groupId === groupId);
  return p ? hydrate(p) : null;
}

export const getCategories = () => [...new Set(projects.map((p) => p.category).filter(Boolean))].sort();
