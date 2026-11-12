// Centralized role & permission checks. Backend must enforce the same rules later.
export const ACCOUNT_TYPES = { STUDENT: 'Student', FACULTY: 'Faculty', GUEST: 'Guest' };
export const FACULTY_ROLES = { ADVISER: 'Adviser', ADMIN: 'Admin' };

export const isStudent = (u) => u?.accountType === ACCOUNT_TYPES.STUDENT;
export const isFaculty = (u) => u?.accountType === ACCOUNT_TYPES.FACULTY;
export const isGuest = (u) => u?.accountType === ACCOUNT_TYPES.GUEST || u?.role?.toLowerCase() === 'guest';
export const isAdmin = (u) => isFaculty(u) && (u.role === FACULTY_ROLES.ADMIN || u.role?.toLowerCase() === 'admin');

// Hide All / Show All feature is completely removed.
export const canToggleRatings = () => false;

export const homePathFor = (u) => {
  if (isGuest(u)) return '/guest/all-projects';
  if (isStudent(u)) return '/student/my-group';
  if (isFaculty(u)) return '/faculty/all-projects';
  return '/login';
};

export const basePathFor = (u) => {
  if (isGuest(u)) return '/guest';
  if (isStudent(u)) return '/student';
  return '/faculty';
};

/**
 * Rating Visibility:
 * Ratings are visible ONLY to Faculty users with the role Admin.
 * Students, Faculty Advisers, and Guests must not be able to view ratings.
 */
export function canViewRatings(user) {
  return isAdmin(user);
}

export function ratingsHiddenReason(user) {
  if (isAdmin(user)) return '';
  return 'Ratings are confidential and visible only to system administrators.';
}
