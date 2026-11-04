// Centralized role & permission checks. Backend must enforce the same rules later.
export const ACCOUNT_TYPES = { STUDENT: 'Student', FACULTY: 'Faculty' };
export const FACULTY_ROLES = { ADVISER: 'Adviser', ADMIN: 'Admin' };

export const isStudent = (u) => u?.accountType === ACCOUNT_TYPES.STUDENT;
export const isFaculty = (u) => u?.accountType === ACCOUNT_TYPES.FACULTY;
export const isAdmin = (u) => isFaculty(u) && u.role === FACULTY_ROLES.ADMIN;

export const canToggleRatings = (u) => isAdmin(u);

export const homePathFor = (u) => (isStudent(u) ? '/student/my-group' : isFaculty(u) ? '/faculty/all-projects' : '/login');
export const basePathFor = (u) => (isStudent(u) ? '/student' : '/faculty');

/**
 * Two independent settings control rating display:
 *  - settings.ratingsVisible  (global, Admin-controlled): hides ratings for everyone.
 *  - settings.resultsPublished: students additionally need results to be published.
 */
export function canViewRatings(user, settings) {
  if (!settings?.ratingsVisible) return false;
  if (isStudent(user)) return Boolean(settings.resultsPublished);
  return isFaculty(user);
}

export function ratingsHiddenReason(user, settings) {
  if (!settings?.ratingsVisible) return 'Ratings are currently hidden by an administrator.';
  if (isStudent(user) && !settings.resultsPublished) return 'Ratings will be shown once results are officially published.';
  return '';
}
