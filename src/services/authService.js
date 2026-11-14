
import { request, setAuthToken } from '../config/apiConfig.js';
import { load, save, remove } from './localStore.js';

/**
 * Sends authentication request to Google Apps Script backend.
 */
export async function login(identifier, password, role) {
  const response = await request('login', {
    method: 'POST',
    body: {
      identifier: identifier.trim(),
      password: password.trim(),
      role: role || 'Student'
    }
  });
  if (!response.user) throw new Error('The server did not return an authenticated user.');

  const user = response.user;
  const normalizedRole = (response.role || role || 'Student').toLowerCase();

  const isGuest = normalizedRole === 'guest';
  const isFaculty =
    !isGuest &&
    (normalizedRole === 'faculty' ||
      normalizedRole === 'admin' ||
      normalizedRole === 'adviser');
  const sessionToken = typeof response.sessionToken === 'string'
    ? response.sessionToken.trim()
    : '';

  if (!sessionToken) {
    throw new Error('The server did not create an authenticated session. Please try again.');
  }

  // Normalize profile fields for the frontend.
  const sessionUser = {
    ...user,

    // Common fields
    id: user.StudentID || user.FacultyID || user.GuestID || user.id || 'GUEST-001',
    name: user.FullName || user.name || user.NAME || (isGuest ? 'Guest User' : ''),
    
    // Student fields
    groupId: user.GroupCode || user.groupId || '',
    studentNo: user.StudentNo || user.studentNo || '',
    program: user.Program || user.program || '',
    sec: user.Sec || user.sec || '',

    // Faculty fields
    facultyId: user.FacultyID || user.facultyId || '',

    // Role fields
    accountType: isGuest ? 'Guest' : isFaculty ? 'Faculty' : 'Student',
    role:
      isGuest
        ? 'Guest'
        : normalizedRole === 'admin'
          ? 'Admin'
          : normalizedRole === 'adviser' || normalizedRole === 'faculty'
            ? 'Adviser'
            : 'Student'
  };

  save('session', { user: sessionUser, sessionToken: sessionToken || null }, { replaceCorrupt: true });
  setAuthToken(sessionToken);

  return sessionUser;
}

export function logout() {
  setAuthToken(null);
  remove('session');
}

export function getCurrentUser() {
  let session;

  try {
    session = load('session', null);
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }

  if (!session || !session.user) return null;
  setAuthToken(session.sessionToken);

  return session.user;
}
