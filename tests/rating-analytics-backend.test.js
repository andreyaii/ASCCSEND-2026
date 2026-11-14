import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');

function createBackend(role, facultyRows = [['FAC-2', 'Faculty Evaluator', 'Adviser']]) {
  const evaluations = [
    ['EV-1', 'STUDENT-1', 'GROUP-1', 5, 4, 3, '', '2026-11-12 10:00:00'],
    ['EV-2', 'FAC-2', 'GROUP-2', 2, 3, 4, '', '2026-11-12 11:00:00'],
    ['EV-3', 'ADMIN-1', 'GROUP-3', 4, 4, 4, '', '2026-11-12 12:00:00'],
  ];
  const sheets = {
    Evaluations: [
      ['EvaluationID', 'StudentID', 'GroupCode', 'ProposalRating', 'PitchVideoRating', 'PosterRating', 'Comment', 'SubmittedAt'],
      ...evaluations,
    ],
    Students: [['StudentID'], ['STUDENT-1']],
    Faculty: [['FacultyID', 'FullName', 'Role'], ...facultyRows],
  };
  const cache = new Map([[
    'faculty-session:test-token',
    JSON.stringify({ facultyId: 'ADMIN-1', role }),
  ]]);
  const spreadsheet = {
    getSheetByName(name) {
      const values = sheets[name];
      if (!values) return null;
      return {
        getLastColumn: () => values[0].length,
        getRange: () => ({ getDisplayValues: () => [values[0]] }),
        getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
      };
    },
  };
  const context = {
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key) || null,
        put: (key, value) => cache.set(key, value),
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-sheet' }) },
    SpreadsheetApp: { openById: () => spreadsheet },
    Logger: { log() {} },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content) {
        return { content, setMimeType() { return this; } };
      },
    },
  };
  runInNewContext(script, context);
  return context;
}

test('Admin analytics uses the authenticated Admin session without an Admin Faculty row or group assignment', () => {
  const backend = createBackend('Admin');
  const response = backend.doGet({ parameter: { action: 'getRatingAnalytics', sessionToken: 'test-token' } });
  const result = JSON.parse(response.content);

  assert.equal(result.success, true, result.message);
  assert.deepEqual(result.data.evaluations.map((evaluation) => evaluation.GroupCode), ['GROUP-1', 'GROUP-2', 'GROUP-3']);
});

test('Faculty Advisers cannot access Admin analytics', () => {
  const backend = createBackend('Adviser');
  const response = backend.doGet({ parameter: { action: 'getRatingAnalytics', sessionToken: 'test-token' } });
  const result = JSON.parse(response.content);

  assert.equal(result.success, false);
  assert.match(result.message, /Only faculty administrators/);
});

test('Faculty evaluation history returns only the authenticated Admin’s rows without a profile lookup', () => {
  const backend = createBackend('Admin');
  const response = backend.doGet({ parameter: { action: 'getFacultyEvaluationData', sessionToken: 'test-token' } });
  const result = JSON.parse(response.content);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.evaluations.map((evaluation) => evaluation.EvaluationID), ['EV-3']);
});

test('Faculty Adviser evaluation history is scoped to the Adviser account', () => {
  const backend = createBackend('Adviser');
  const cache = backend.CacheService.getScriptCache();
  cache.put('faculty-session:test-token', JSON.stringify({ facultyId: 'FAC-2', role: 'Adviser' }));
  const response = backend.doGet({ parameter: { action: 'getFacultyEvaluationData', sessionToken: 'test-token' } });
  const result = JSON.parse(response.content);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.evaluations.map((evaluation) => evaluation.EvaluationID), ['EV-2']);
});
