
import { request } from '../config/apiConfig';
import { getProjects } from './projectService';

/**
 * Retrieves actual groups from Google Sheets
 * and formats them for the frontend.
 */
export async function getGroups() {
  const projects = await getProjects();

  return projects.map((project) => ({
    ...project,
    id: project.groupCode,
    groupCode: project.groupCode,
    groupName: project.title || project.groupCode,
    title: project.title,
    members: project.group?.members || [],
    advisers: []
  }));
}

/**
 * Finds a group using its GroupCode.
 */
export async function getGroupById(groupCode) {
  if (!groupCode) return null;

  const groups = await getGroups();

  return groups.find(
    (group) =>
      String(group.groupCode).trim() === String(groupCode).trim()
  ) || null;
}
