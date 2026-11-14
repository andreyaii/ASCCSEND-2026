import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');

function createBackend(role, facultyRows = [['FAC-2', 'Faculty Evaluator', 'Adviser']]) {
  const evaluations = [
    ['EV-1', 'STUDENT-1', 'GROUP-1', 5, 4, 3, 4, '', '2026-11-12 10:00:00'],
    ['EV-2', 'FAC-2', 'GROUP-2', 2, 3, 4, 5, '', '2026-11-12 11:00:00'],
    ['EV-3', 'ADMIN-1', 'GROUP-3', 4, 4, 4, 3, '', '2026-11-12 12:00:00'],
  ];
  const sheets = {
    Evaluations: [
      ['EvaluationID', 'StudentID', 'GroupCode', 'ResearchPaperRating', 'PitchVideoRating', 'PosterRating', 'LogoRating', 'Comment', 'SubmittedAt'],
      ...evaluations,
    ],
    Students: [['StudentID'], ['STUDENT-1']],
    Faculty: [['FacultyID', 'FullName', 'Role'], ...facultyRows],
    Groups: [
      ['GroupCode', 'Adviser'],
      ['GROUP-1', 'Other Faculty'],
      ['GROUP-2', 'Other Faculty'],
      ['GROUP-3', 'Other Faculty'],
      ['GROUP-4', 'Other Faculty'],
    ],
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
        getLastRow: () => values.length,
        getRange(row, column, rowCount = 1, columnCount = values[0].length) {
          return {
            getDisplayValues: () => values
              .slice(row - 1, row - 1 + rowCount)
              .map((valueRow) => valueRow.slice(column - 1, column - 1 + columnCount)),
          };
        },
        getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
        appendRow: (row) => values.push([...row]),
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
    LockService: {
      getScriptLock: () => ({
        waitLock() {},
        releaseLock() {},
      }),
    },
    Utilities: {
      formatDate: () => '2026-11-14 09:00:00',
    },
    Logger: { log() {} },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content) {
        return { content, setMimeType() { return this; } };
      },
    },
  };
  context.sheets = sheets;
  runInNewContext(script, context);
  return context;
}

test('Admin analytics uses the authenticated Admin session without an Admin Faculty row or group assignment', () => {
  const backend = createBackend('Admin');
  const response = backend.doGet({ parameter: { action: 'getRatingAnalytics', sessionToken: 'test-token' } });
  const result = JSON.parse(response.content);

  assert.equal(result.success, true, result.message);
  assert.deepEqual(result.data.evaluations.map((evaluation) => evaluation.GroupCode), ['GROUP-1', 'GROUP-2', 'GROUP-3']);
  assert.equal(result.data.evaluations[0].ResearchPaperRating, 5);
  assert.equal(result.data.evaluations[0].LogoRating, 4);
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

test('Apps Script stores the Research Paper and Logo ratings in the matching sheet columns', () => {
  const backend = createBackend('Adviser');
  const cache = backend.CacheService.getScriptCache();
  cache.put('faculty-session:test-token', JSON.stringify({ facultyId: 'FAC-2', role: 'Adviser' }));
  const evaluations = backend.sheets.Evaluations;
  const headers = evaluations[0];
  const reorderedHeaders = [...headers.filter((header) => header !== 'LogoRating'), 'LogoRating'];
  evaluations.forEach((row, index) => {
    const values = Object.fromEntries(headers.map((header, column) => [header, row[column]]));
    evaluations[index] = reorderedHeaders.map((header) => values[header]);
  });

  const response = backend.doPost({
    postData: {
      contents: JSON.stringify({
        action: 'submitEvaluation',
        sessionToken: 'test-token',
        groupCode: 'GROUP-4',
        researchPaperRating: 5,
        pitchVideoRating: 4,
        posterRating: 3,
        logoRating: 2,
        comment: 'Clear and relevant.',
      }),
    },
  });
  const result = JSON.parse(response.content);

  assert.equal(result.success, true, result.message);
  const savedRow = backend.sheets.Evaluations.at(-1);
  const savedEvaluation = Object.fromEntries(reorderedHeaders.map((header, index) => [header, savedRow[index]]));
  assert.equal(savedEvaluation.EvaluationID, result.evaluationId);
  assert.equal(savedEvaluation.StudentID, 'FAC-2');
  assert.equal(savedEvaluation.GroupCode, 'GROUP-4');
  assert.equal(savedEvaluation.ResearchPaperRating, 5);
  assert.equal(savedEvaluation.PitchVideoRating, 4);
  assert.equal(savedEvaluation.PosterRating, 3);
  assert.equal(savedEvaluation.LogoRating, 2);
  assert.equal(savedEvaluation.Comment, 'Clear and relevant.');
  assert.equal(savedEvaluation.SubmittedAt, '2026-11-14 09:00:00');
});
