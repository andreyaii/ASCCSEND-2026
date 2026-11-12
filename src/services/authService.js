
import { request, setAuthToken } from '../config/apiConfig.js';
import { load, save, remove } from './mockStore.js';

/**
 * Sends authentication request to Google Apps Script backend.
 */
export const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'student@techcon.edu', password: 'techcon123' },
  { label: 'Faculty Adviser', email: 'adviser@techcon.edu', password: 'techcon123' },
  { label: 'Faculty Admin', email: 'admin@techcon.edu', password: 'techcon123' },
  { label: 'Guest', email: 'guest@techcon.edu', password: 'guest' },
];

/**
 * Sends authentication request to Google Apps Script backend.
 */
export async function login(identifier, password, role) {
  const normalizedRoleInput = (role || 'Student').trim().toLowerCase();
  const isGuestIdentifier = normalizedRoleInput === 'faculty'
    && identifier.trim().toLowerCase() === 'guest';
  const isGuestRole = normalizedRoleInput === 'guest' || isGuestIdentifier;

  let response;
  try {
    response = await request('login', {
      method: 'POST',
      body: {
        identifier: identifier.trim(),
        password: password.trim(),
        role: role || 'Student'
      }
    });
  } catch (err) {
    if (isGuestRole) {
      // Allow guest login even if the remote Apps Script deployment hasn't been updated yet
      const idLower = identifier.trim().toLowerCase();
      const passTrim = password.trim();
      const validGuestId = idLower === 'guest' || idLower === 'guest@techcon.edu' || idLower === 'guest-001';
      const validGuestPass = passTrim === 'guest' || passTrim === 'techcon123' || passTrim === 'guest123';
      if (validGuestId && validGuestPass) {
        response = {
          success: true,
          user: {
            GuestID: 'GUEST-001',
            FullName: 'Guest User',
            Role: 'Guest'
          },
          role: 'guest',
          sessionToken: 'guest-session'
        };
      } else {
        throw new Error('Invalid Guest credentials. You can use guest / guest.');
      }
    } else {
      throw err;
    }
  }

  if (!response || !response.success || !response.user) {
    if (isGuestRole) {
      const idLower = identifier.trim().toLowerCase();
      const passTrim = password.trim();
      const validGuestId = idLower === 'guest' || idLower === 'guest@techcon.edu' || idLower === 'guest-001';
      const validGuestPass = passTrim === 'guest' || passTrim === 'techcon123' || passTrim === 'guest123';
      if (validGuestId && validGuestPass) {
        response = {
          success: true,
          user: {
            GuestID: 'GUEST-001',
            FullName: 'Guest User',
            Role: 'Guest'
          },
          role: 'guest',
          sessionToken: 'guest-session'
        };
      } else {
        throw new Error('Invalid Guest credentials. You can use guest / guest.');
      }
    } else {
      throw new Error(
        response?.message || `Invalid ${role || 'account'} credentials.`
      );
    }
  }

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
    : isGuest ? 'guest-session' : '';

  if (!isFaculty && !isGuest && !sessionToken) {
    throw new Error('The server did not create an authenticated student session. Please try again.');
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
