import { students } from '../data/students.js';
import { faculty } from '../data/faculty.js';
import { delay, load, save, remove } from './mockStore.js';
import { setAuthToken } from '../config/apiConfig.js';

const MOCK_PASSWORD = 'techcon123';
export const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'student@techcon.edu', password: MOCK_PASSWORD },
  { label: 'Faculty Adviser', email: 'adviser@techcon.edu', password: MOCK_PASSWORD },
  { label: 'Faculty Admin', email: 'admin@techcon.edu', password: MOCK_PASSWORD },
];

// Session only stores the user id; the user record is re-read from the data source.
export async function login(identifier, password, role) {
  await delay(300);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const user = [...students, ...faculty].find((account) => {
    const matchesIdentifier = [account.email, account.studentId, account.facultyId]
      .filter(Boolean)
      .some((value) => value.toLowerCase() === normalizedIdentifier);
    if (!matchesIdentifier) return false;
    if (role === 'Student') return account.accountType === 'Student';
    if (role === 'Faculty') return account.accountType === 'Faculty';
    return true;
  });
  if (!user || password !== MOCK_PASSWORD) throw new Error(`Invalid ${role || 'account'} ID or password.`);
  save('session', { userId: user.id }, { replaceCorrupt: true });
  setAuthToken('demo-only-mock-token');
  return user;
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
    console.error(error);
    return null;
  }
  if (!session || typeof session.userId !== 'string') return null;
  return [...students, ...faculty].find((u) => u.id === session.userId) || null;
}
