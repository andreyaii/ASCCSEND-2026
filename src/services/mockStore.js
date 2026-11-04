// All localStorage access lives here so it can be swapped for API calls later.
const PREFIX = 'techcon:';

export const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storageError(action, error) {
  return new Error(`Could not ${action} local demo data. Check browser storage availability and space.`, { cause: error });
}

export function load(key, fallback) {
  let raw;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch (error) {
    throw storageError('read', error);
  }
  if (raw === null) return clone(fallback);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Saved ${key} data is corrupted. Reset the demo data or clear the invalid ${PREFIX + key} entry.`, { cause: error });
  }
}

export function save(key, value, { replaceCorrupt = false } = {}) {
  if (!replaceCorrupt) load(key, null);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    throw storageError('save', error);
  }
  return value;
}

export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch (error) {
    throw storageError('remove', error);
  }
}
