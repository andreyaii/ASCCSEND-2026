import { request } from '../config/apiConfig.js';
import { initialSettings, evaluationCriteria } from '../data/settings.js';

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('The evaluation settings response is invalid.');
  }
  const value = { ...initialSettings, ...settings };
  if (!['free-select', 'assigned'].includes(value.evaluationAssignmentMethod)) {
    throw new Error('The evaluation assignment method is invalid.');
  }
  if (!Number.isInteger(value.commentMaxLength) || value.commentMaxLength < 0) {
    throw new Error('The comment length limit must be a non-negative whole number.');
  }
  return value;
}

function normalizeSettingName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function getSettings() {
  const response = await request('getSettings');
  if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new Error('The evaluation settings response is invalid.');
  }

  const settings = { ...initialSettings };
  Object.entries(response.data).forEach(([name, value]) => {
    const key = normalizeSettingName(name);
    if (key === 'evaluationassignmentmethod') {
      settings.evaluationAssignmentMethod = String(value).trim().toLowerCase();
    } else if (key === 'commentmaxlength') {
      settings.commentMaxLength = Number(value);
    }
  });
  return validateSettings(settings);
}

export async function getEvaluationCriteria() {
  return evaluationCriteria;
}
