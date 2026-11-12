import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { initialSettings, evaluationCriteria } from '../src/data/settings.js';
import { checkEligibility } from '../src/services/evaluationAssignment.js';
import { getAggregates, getEligibility, getEvaluationStatus, getStudentEvaluationData, submitEvaluation } from '../src/services/evaluationService.js';
import { deleteProjectThumbnail, getProjects } from '../src/services/projectService.js';
import { load, save } from '../src/services/mockStore.js';
import { students } from '../src/data/students.js';
import { groups } from '../src/data/groups.js';
import { calcOverall } from '../src/utils/ratings.js';
import { getProjectLogoUrl } from '../src/utils/projectLogo.js';

const entries = new Map();
let apiEvaluations;
let apiGroups;
let currentStudent;
let apiFailure;
let requestCounts;
const validRatings = { c1: 4, c2: 5, c3: 3 };
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('project logo URLs preserve the working Drive thumbnail URL', () => {
  assert.equal(
    getProjectLogoUrl({ thumbnail: 'https://drive.google.com/thumbnail?id=logo-file&sz=w1200&v=123' }),
    'https://drive.google.com/thumbnail?id=logo-file&sz=w1200&v=123',
  );
  assert.equal(getProjectLogoUrl({ imageUrl: 'javascript:alert(1)' }), '');
});

globalThis.window = {
  localStorage: {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  },
};

beforeEach(() => {
  entries.clear();
  currentStudent = { id: 's1', accountType: 'Student', groupId: 'g1' };
  entries.set('techcon:session', JSON.stringify({ user: currentStudent, sessionToken: 'test-session' }));
  apiEvaluations = [];
  apiGroups = groups.map((group) => ({ groupCode: group.id, title: group.groupName, tag: 'Test' }));
  apiFailure = false;
  requestCounts = new Map();
  globalThis.fetch = async (url, options = {}) => {
    if (apiFailure) return response({ message: 'Database unavailable' }, 503);
    const requestUrl = new URL(url);
    const payload = options.method === 'POST' ? JSON.parse(options.body) : {};
    const action = requestUrl.searchParams.get('action') || payload.action;
    requestCounts.set(action, (requestCounts.get(action) || 0) + 1);
    const mine = apiEvaluations.filter((evaluation) => evaluation.StudentID === currentStudent.id);

    if (action === 'getProjects') return response({ success: true, data: apiGroups });
    if (action === 'deleteThumbnail') {
      assert.equal(payload.sessionToken, 'test-session');
      return response({ success: true, thumbnail: null });
    }
    if (action === 'getStudentEvaluationData') {
      return response({
        success: true,
        data: {
          evaluations: mine,
          status: { submitted: mine.length },
        },
      });
    }
    if (action === 'getEvaluationStatus') {
      return response({ success: true, data: { submitted: mine.length } });
    }
    if (action === 'getEvaluationEligibility') {
      const groupCode = requestUrl.searchParams.get('groupCode');
      const duplicate = mine.some((evaluation) => evaluation.GroupCode === groupCode);
      const ownGroup = currentStudent.groupId === groupCode;
      const code = !apiGroups.some((group) => group.groupCode === groupCode)
        ? 'missing-group'
        : ownGroup ? 'own-group'
          : duplicate ? 'duplicate'
            : 'ok';
      const reasons = {
        'missing-group': 'This project group could not be found.',
        'own-group': 'You cannot evaluate your own group.',
        duplicate: 'You have already evaluated this group.',
      };
      return response({
        success: true,
        data: { canEvaluate: code === 'ok', code, reason: reasons[code] || '', submitted: mine.length },
      });
    }
    if (action === 'submitEvaluation') {
      assert.equal(payload.sessionToken, 'test-session');
      assert.equal(Object.hasOwn(payload, 'studentId'), false);
      assert.equal(Object.hasOwn(payload, 'documentationRating'), false);
      apiEvaluations.push({
        EvaluationID: 'EV-test',
        StudentID: currentStudent.id,
        GroupCode: payload.groupCode,
        ProposalRating: payload.proposalRating,
        PitchVideoRating: payload.pitchVideoRating,
        PosterRating: payload.posterRating,
        Comment: payload.comment,
        SubmittedAt: '2026-11-11T00:00:00.000Z',
      });
      return response({ success: true, evaluationId: 'EV-test', submittedAt: '2026-11-11T00:00:00.000Z' });
    }
    return response({ success: false, message: `Unexpected action: ${action}` });
  };
});

test('student evaluation submission uses the authenticated API and mapped sheet fields', async () => {
  currentStudent = { id: 'STD-104', accountType: 'Student', groupId: 'GROUP-A' };
  entries.set('techcon:session', JSON.stringify({ user: currentStudent, sessionToken: 'test-session' }));
  apiGroups = [
    { groupCode: 'GROUP-A', title: 'Own Group', tag: 'Test' },
    { groupCode: 'GROUP-B', title: 'Other Group', tag: 'Test' },
  ];

  const eligibility = await getEligibility(currentStudent.id, 'GROUP-B');
  assert.equal(eligibility.canEvaluate, true);
  const submitted = await submitEvaluation({
    evaluatorId: currentStudent.id,
    evaluatedGroupId: 'GROUP-B',
    ratings: validRatings,
    comments: '  Clear presentation  ',
  });
  const { evaluations: mine } = await getStudentEvaluationData(currentStudent.id);

  assert.equal(submitted.id, 'EV-test');
  assert.deepEqual(mine[0].ratings, validRatings);
  assert.equal(mine[0].overallScore, 4);
  assert.equal(mine[0].comments, 'Clear presentation');
  assert.deepEqual(
    Object.keys(apiEvaluations[0]),
    ['EvaluationID', 'StudentID', 'GroupCode', 'ProposalRating', 'PitchVideoRating', 'PosterRating', 'Comment', 'SubmittedAt'],
  );
  assert.equal(apiEvaluations[0].StudentID, currentStudent.id);
  assert.equal(apiEvaluations[0].PosterRating, 3);
});

test('evaluation form exposes only proposal, pitch video, and poster categories', () => {
  assert.deepEqual(evaluationCriteria.map((criterion) => criterion.label), [
    'Proposal',
    'Pitch Video',
    'Poster',
  ]);
});

test('existing local demo evaluation aggregates remain valid', async () => {
  const aggregates = await getAggregates();
  assert.ok(Object.keys(aggregates).length > 0);
});

test('evaluation history and status share one authenticated API request', async () => {
  apiEvaluations.push({
    EvaluationID: 'EV-existing',
    StudentID: 's1',
    GroupCode: 'g2',
    ProposalRating: 3,
    PitchVideoRating: 4,
    PosterRating: 5,
    Comment: '',
    SubmittedAt: '2026-11-10T00:00:00.000Z',
  });
  apiEvaluations.push({
    EvaluationID: 'EV-new-format',
    StudentID: 's1',
    GroupCode: 'g3',
    ProposalRating: 4,
    PitchVideoRating: 4,
    PosterRating: 4,
    Comment: '',
    SubmittedAt: '2026-11-11 12:30:45',
  });

  const { evaluations: mine, status } = await getStudentEvaluationData('s1');
  assert.equal(mine[0].overallScore, 4);
  assert.equal(mine[1].submittedAt, '2026-11-11 12:30:45');
  assert.deepEqual(status, { submitted: 2 });
  assert.equal(requestCounts.get('getStudentEvaluationData'), 1);
});

test('concurrent project loads share a single request and cache the result', async () => {
  const [first, second] = await Promise.all([
    getProjects({ refresh: true }),
    getProjects(),
  ]);
  assert.equal(requestCounts.get('getProjects'), 1);
  assert.equal(first.length, second.length);
  await getProjects();
  assert.equal(requestCounts.get('getProjects'), 1);
});

test('project thumbnails are exposed using the image URL consumed by project views', async () => {
  const thumbnail = 'https://drive.google.com/thumbnail?id=drive-file&sz=w1200';
  apiGroups = [{ groupCode: 'g2', title: 'Project with thumbnail', thumbnail }];

  const [project] = await getProjects({ refresh: true });

  assert.equal(project.thumbnail, thumbnail);
  assert.equal(project.imageUrl, thumbnail);
});

test('thumbnail deletion uses the authenticated API action', async () => {
  await deleteProjectThumbnail();

  assert.equal(requestCounts.get('deleteThumbnail'), 1);
});

test('forced project refresh bypasses the cached project response', async () => {
  const first = await getProjects({ refresh: true });
  apiGroups = [...apiGroups, { groupCode: 'g-new', title: 'New project', tag: 'Test' }];

  const refreshed = await getProjects({ refresh: true });
  assert.equal(requestCounts.get('getProjects'), 2);
  assert.equal(refreshed.length, first.length + 1);
  assert.equal(refreshed.some((project) => project.groupId === 'g-new'), true);
});

test('identical concurrent API reads share one in-flight request without caching later results', async () => {
  const [first, second] = await Promise.all([
    getEvaluationStatus('s1'),
    getEvaluationStatus('s1'),
  ]);
  assert.deepEqual(first, second);
  assert.equal(requestCounts.get('getEvaluationStatus'), 1);
  await getEvaluationStatus('s1');
  assert.equal(requestCounts.get('getEvaluationStatus'), 2);
});

test('eligibility blocks self, duplicate, and missing groups', async () => {
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g1', ratings: validRatings }),
    /own group/,
  );

  apiEvaluations.push({
    EvaluationID: 'EV-existing',
    StudentID: 's1',
    GroupCode: 'g2',
    ProposalRating: 4,
    PitchVideoRating: 4,
    PosterRating: 4,
    Comment: '',
    SubmittedAt: new Date().toISOString(),
  });
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g2', ratings: validRatings }),
    /already evaluated/,
  );
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'missing', ratings: validRatings }),
    /could not be found/,
  );

  for (let index = 3; index <= 6; index += 1) {
    apiEvaluations.push({
      EvaluationID: `EV-${index}`,
      StudentID: 's1',
      GroupCode: `g${index}`,
      ProposalRating: 4,
      PitchVideoRating: 4,
      PosterRating: 4,
      Comment: '',
      SubmittedAt: new Date().toISOString(),
    });
  }
  apiGroups.push({ groupCode: 'g7', title: 'Additional project', tag: 'Test' });
  assert.equal((await getEligibility('s1', 'g7')).canEvaluate, true);
  await submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g7', ratings: validRatings });
  assert.equal((await getEvaluationStatus('s1')).submitted, 6);
});

test('submission validates ratings and comment length before calling the API', async () => {
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: { ...validRatings, c1: 6 } }),
    /rate every criterion/,
  );
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: { ...validRatings, c2: 2.5 } }),
    /rate every criterion/,
  );
  save('settings', { ...initialSettings, commentMaxLength: 3 });
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: validRatings, comments: 'four' }),
    /3 characters or fewer/,
  );
});

test('simultaneous submissions are guarded in the client and the backend remains authoritative', async () => {
  const outcomes = await Promise.allSettled([
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: validRatings }),
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g5', ratings: validRatings }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
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

test('assigned evaluation mode remains enforced by the existing client assignment strategy', async () => {
  save('settings', { ...initialSettings, evaluationAssignmentMethod: 'assigned' });
  const eligibility = await getEligibility('s1', 'g4');
  assert.equal(eligibility.canEvaluate, false);
  assert.equal(eligibility.code, 'not-assigned');
});

test('database request failures surface instead of falling back to local evaluation data', async () => {
  apiFailure = true;
  await assert.rejects(getEvaluationStatus('s1'), /Database unavailable/);
  assert.equal(load('evaluations', []).length, 0);
  assert.equal(calcOverall(validRatings), 4);

  entries.set('techcon:session', JSON.stringify({ user: currentStudent }));
  await assert.rejects(getEvaluationStatus('s1'), /session has expired/);
});

test('corrupted local demo data and failed writes surface explicit errors', () => {
  entries.set('techcon:evaluations', '{invalid');
  assert.throws(() => load('evaluations', []), /corrupted/);
  assert.throws(() => save('evaluations', []), /corrupted/);
});
