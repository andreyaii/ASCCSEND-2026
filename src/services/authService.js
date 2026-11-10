
import { request, setAuthToken } from '../config/apiConfig.js';
import { load, save, remove } from './mockStore.js';

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

  if (!response.success || !response.user) {
    throw new Error(
      response.message || `Invalid ${role || 'account'} credentials.`
    );
  }

  const user = response.user;
  const normalizedRole = (response.role || role || 'Student').toLowerCase();

  const isFaculty =
    normalizedRole === 'faculty' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'adviser';

  // Normalize profile fields for the frontend.
  const sessionUser = {
    ...user,

    // Common fields
    id: user.StudentID || user.FacultyID || user.id,
    name: user.FullName || user.name || user.NAME || '',
    
    // Student fields
    groupId: user.GroupCode || user.groupId || '',
    studentNo: user.StudentNo || user.studentNo || '',
    program: user.Program || user.program || '',
    sec: user.Sec || user.sec || '',

    // Role fields
    accountType: isFaculty ? 'Faculty' : 'Student',
    role:
      normalizedRole === 'admin'
        ? 'Admin'
        : normalizedRole === 'adviser' || normalizedRole === 'faculty'
          ? 'Adviser'
          : 'Student'
  };

  save('session', { user: sessionUser }, { replaceCorrupt: true });
  setAuthToken(`gas-token-${sessionUser.id}`);

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

  return session.user;
}
