import { initialSettings, evaluationCriteria } from '../data/settings.js';
import { getCurrentUser } from './authService.js';
import { load, save } from './mockStore.js';
import { isAdmin } from '../utils/roles.js';

const isDemoAdmin = (user) =>
  Boolean(import.meta.env?.DEV && user && isAdmin(user) && getCurrentUser()?.id === user.id);

function assertDemoAdmin(user) {
  if (!isDemoAdmin(user)) throw new Error('This demo-only control is available to signed-in administrators in development mode.');
}

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Saved settings are invalid. Reset the demo settings before continuing.');
  }
  const value = { ...initialSettings, ...settings };
  if (typeof value.ratingsVisible !== 'boolean' || typeof value.resultsPublished !== 'boolean') {
    throw new Error('Saved rating visibility settings are invalid.');
  }
  if (!['free-select', 'assigned'].includes(value.evaluationAssignmentMethod)) {
    throw new Error('The evaluation assignment method is invalid.');
  }
  if (!Number.isInteger(value.commentMaxLength) || value.commentMaxLength < 0) {
    throw new Error('The comment length limit must be a non-negative whole number.');
  }
  return value;
}

export async function getSettings() {
  return validateSettings(load('settings', initialSettings));
}

async function updateSettings(user, patch) {
  assertDemoAdmin(user);
  const next = validateSettings({ ...(await getSettings()), ...patch });
  save('settings', next);
  return next;
}

// Display settings never change submitted evaluation records.
export const setRatingsVisible = (user, visible) => {
  if (typeof visible !== 'boolean') throw new Error('Rating visibility must be enabled or disabled.');
  return updateSettings(user, { ratingsVisible: visible });
};

export const setResultsPublished = (user, published) => {
  if (typeof published !== 'boolean') throw new Error('Result publication must be enabled or disabled.');
  return updateSettings(user, { resultsPublished: published });
};

export async function getEvaluationCriteria() {
  return evaluationCriteria;
}

export function resetSettings(user) {
  assertDemoAdmin(user);
  return save('settings', initialSettings, { replaceCorrupt: true });
}
