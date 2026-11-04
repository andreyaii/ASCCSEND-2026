import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { evaluations as seedEvaluations } from '../src/data/evaluations.js';
import { initialSettings } from '../src/data/settings.js';
import { checkEligibility } from '../src/services/evaluationAssignment.js';
import { submitEvaluation } from '../src/services/evaluationService.js';
import { load, save } from '../src/services/mockStore.js';
import { students } from '../src/data/students.js';
import { calcOverall } from '../src/utils/ratings.js';

const entries = new Map();
let failWrites = false;
globalThis.window = {
  localStorage: {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrites) throw new Error('Storage is full');
      entries.set(key, value);
    },
    removeItem: (key) => entries.delete(key),
  },
};

const validRatings = { c1: 4, c2: 4, c3: 4, c4: 4, c5: 4 };

beforeEach(() => {
  entries.clear();
  entries.set('techcon:session', JSON.stringify({ userId: 's1' }));
  failWrites = false;
});

test('overall score uses configured criteria only', () => {
  assert.equal(calcOverall({ ...validRatings, unconfigured: 1 }), 4);
});

test('eligibility blocks self, duplicate, and over-limit evaluations', async () => {
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g1', ratings: validRatings }),
    /own group/
  );
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g2', ratings: validRatings }),
    /already evaluated/
  );
  entries.set('techcon:evaluations', JSON.stringify([
    ...seedEvaluations,
    ...['g4', 'g5', 'g6'].map((evaluatedGroupId, index) => ({
      id: `extra${index}`,
      evaluatorId: 's1',
      evaluatedGroupId,
      ratings: validRatings,
      overallScore: 4,
      comments: '',
      submittedAt: new Date().toISOString(),
    })),
  ]));
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g7', ratings: validRatings }),
    /limit of 5/
  );
});

test('submission validates ratings and saves only configured ratings', async () => {
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: { ...validRatings, c5: 6 } }),
    /rate every criterion/
  );
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: { ...validRatings, c2: 2.5 } }),
    /rate every criterion/
  );
  save('settings', { ...initialSettings, commentMaxLength: 3 });
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: validRatings, comments: 'four' }),
    /3 characters or fewer/
  );
  save('settings', initialSettings);
  const result = await submitEvaluation({
    evaluatorId: 's1',
    evaluatedGroupId: 'g4',
    ratings: { ...validRatings, unconfigured: 1 },
    comments: '  Useful feedback  ',
  });
  assert.equal(result.overallScore, 4);
  assert.deepEqual(result.ratings, validRatings);
  assert.equal(result.comments, 'Useful feedback');
  assert.equal(JSON.parse(entries.get('techcon:evaluations')).at(-1).id, result.id);
});

test('simultaneous submissions cannot race the evaluation limit or duplicate checks', async () => {
  const outcomes = await Promise.allSettled([
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: validRatings }),
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g5', ratings: validRatings }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(JSON.parse(entries.get('techcon:evaluations')).filter((e) => e.evaluatorId === 's1').length, 3);
});

test('assigned mode does not silently assign groups', () => {
  const result = checkEligibility({
    student: students[0],
    targetGroupId: 'g4',
    existing: [],
    allGroups: [{ id: 'g1' }, { id: 'g4' }],
    settings: { ...initialSettings, evaluationAssignmentMethod: 'assigned' },
  });
  assert.equal(result.canEvaluate, false);
  assert.match(result.reason, /No assignment.*configured/);
});

test('corrupted data and failed writes surface errors instead of overwriting records', () => {
  entries.set('techcon:evaluations', '{invalid');
  assert.throws(() => load('evaluations', []), /corrupted/);
  assert.throws(() => save('evaluations', []), /corrupted/);
  entries.delete('techcon:evaluations');
  failWrites = true;
  assert.throws(() => save('evaluations', []), /Could not save local demo data/);
});
