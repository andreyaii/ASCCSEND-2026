export const normalizeIdentity = (value) => String(value ?? '').trim().toLowerCase();

export function isProjectAssignedToFaculty(project, user) {
  const groupId = normalizeIdentity(project?.groupId);
  if (groupId && Array.isArray(user?.assignedGroupIds)
    && user.assignedGroupIds.some((id) => normalizeIdentity(id) === groupId)) return true;

  const facultyId = normalizeIdentity(project?.facultyId);
  return Boolean(facultyId && [user?.id, user?.name, user?.facultyId]
    .some((identity) => normalizeIdentity(identity) === facultyId));
}
