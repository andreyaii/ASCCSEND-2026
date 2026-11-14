import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { initialSettings, evaluationCriteria } from '../src/data/settings.js';
import { checkEligibility } from '../src/services/evaluationAssignment.js';
import { getAdminRatingAnalytics, getAggregates, getEligibility, getEvaluationStatus, getFacultyEvaluationData, getStudentEvaluationData, submitEvaluation } from '../src/services/evaluationService.js';
import { deleteProjectThumbnail, getProjects } from '../src/services/projectService.js';
import { getSettings } from '../src/services/settingsService.js';
import { calcOverall } from '../src/utils/ratings.js';
import { getProjectLogoUrl } from '../src/utils/projectLogo.js';
import { isProjectAssignedToFaculty } from '../src/utils/faculty.js';
import { isGuest, isFaculty, isStudent, isAdmin, canViewRatings, canToggleRatings, homePathFor, basePathFor, ratingsHiddenReason } from '../src/utils/roles.js';
import { guestNav } from '../src/config/navigation.js';
import { summarizeRatings } from '../src/utils/ratingAnalytics.js';
import { login } from '../src/services/authService.js';

const entries = new Map();
let apiEvaluations;
let apiGroups;
let apiSettings;
let currentStudent;
let apiFailure;
let requestCounts;
const validRatings = { c1: 4, c2: 5, c3: 3, c4: 4 };
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
  apiGroups = Array.from({ length: 8 }, (_, index) => ({
    groupCode: `g${index + 1}`,
    title: `Group ${String(index + 1).padStart(2, '0')}`,
    tag: 'Test',
  }));
  apiSettings = { EvaluationAssignmentMethod: 'free-select', CommentMaxLength: '500' };
  apiFailure = false;
  requestCounts = new Map();
  globalThis.fetch = async (url, options = {}) => {
    if (apiFailure) return response({ message: 'Database unavailable' }, 503);
    const requestUrl = new URL(url);
    const payload = options.method === 'POST' ? JSON.parse(options.body) : {};
    const action = requestUrl.searchParams.get('action') || payload.action;
    requestCounts.set(action, (requestCounts.get(action) || 0) + 1);
    const activeUser = JSON.parse(entries.get('techcon:session') || '{}').user;
    const mine = apiEvaluations.filter((evaluation) => evaluation.StudentID === activeUser?.id);

    if (action === 'getSettings') return response({ success: true, data: apiSettings });
    if (action === 'getProjects') return response({ success: true, data: apiGroups });
    if (action === 'getRatingAnalytics') {
      return response({
        success: true,
        data: {
          evaluations: apiEvaluations.map((evaluation) => ({
            ...evaluation,
            EvaluatorType: evaluation.StudentID.startsWith('f') ? 'faculty' : 'student',
          })),
        },
      });
    }
    if (action === 'getEvaluations') return response({ success: true, data: mine });
    if (action === 'getFacultyEvaluationData') {
      return response({ success: true, data: { evaluations: mine } });
    }
    if (action === 'getEvaluationsForGroup') {
      const groupCode = requestUrl.searchParams.get('groupCode');
      return response({
        success: true,
        data: apiEvaluations
          .filter((evaluation) => evaluation.GroupCode === groupCode)
          .map((evaluation) => ({ ...evaluation, EvaluatorType: 'student' })),
      });
    }
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
      assert.equal(payload.sessionToken, JSON.parse(entries.get('techcon:session')).sessionToken);
      assert.equal(Object.hasOwn(payload, 'studentId'), false);
      assert.equal(Object.hasOwn(payload, 'documentationRating'), false);
      apiEvaluations.push({
        EvaluationID: 'EV-test',
        StudentID: activeUser.id,
        GroupCode: payload.groupCode,
        ResearchPaperRating: payload.researchPaperRating,
        PitchVideoRating: payload.pitchVideoRating,
        PosterRating: payload.posterRating,
        LogoRating: payload.logoRating,
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
  assert.equal(mine[0].ratings.c1, 4);
  assert.equal(mine[0].ratings.c4, 4);
  assert.equal(mine[0].overallScore, 4);
  assert.equal(mine[0].comments, 'Clear presentation');
  assert.deepEqual(
    Object.keys(apiEvaluations[0]),
    ['EvaluationID', 'StudentID', 'GroupCode', 'ResearchPaperRating', 'PitchVideoRating', 'PosterRating', 'LogoRating', 'Comment', 'SubmittedAt'],
  );
  assert.equal(apiEvaluations[0].StudentID, currentStudent.id);
  assert.equal(apiEvaluations[0].PosterRating, 3);
  assert.equal(apiEvaluations[0].LogoRating, 4);
});

test('evaluation form requires research paper, pitch video, poster, and logo ratings', () => {
  assert.deepEqual(evaluationCriteria.map((criterion) => criterion.label), [
    'Research Paper',
    'Pitch Video',
    'Poster',
    'Logo',
  ]);
});

test('rating aggregates use live records and are only requested by administrators', async () => {
  apiEvaluations.push({
    EvaluationID: 'EV-live',
    StudentID: 's1',
    GroupCode: 'g2',
    ResearchPaperRating: 5,
    PitchVideoRating: 4,
    PosterRating: 3,
    LogoRating: 4,
    Comment: '',
    SubmittedAt: '2026-11-11T00:00:00.000Z',
  });
  assert.deepEqual(await getAggregates(currentStudent), {});

  const admin = { id: 'f3', accountType: 'Faculty', role: 'Admin' };
  entries.set('techcon:session', JSON.stringify({ user: admin, sessionToken: 'test-session' }));
  const aggregates = await getAggregates(admin);
  assert.deepEqual(aggregates.g2, { average: 4, count: 1 });
  assert.equal(requestCounts.get('getRatingAnalytics'), 1);
});

test('faculty My Evaluations loads only records for the signed-in faculty account', async () => {
  const faculty = { id: 'f1', accountType: 'Faculty', role: 'Adviser' };
  entries.set('techcon:session', JSON.stringify({ user: faculty, sessionToken: 'faculty-session' }));
  apiEvaluations.push(
    {
      EvaluationID: 'EV-faculty',
      StudentID: 'f1',
      GroupCode: 'g4',
      ResearchPaperRating: 5,
      PitchVideoRating: 4,
      PosterRating: 3,
      LogoRating: 4,
      Comment: '',
      SubmittedAt: '2026-11-11T00:00:00.000Z',
    },
    {
      EvaluationID: 'EV-student',
      StudentID: 's1',
      GroupCode: 'g5',
      ResearchPaperRating: 3,
      PitchVideoRating: 3,
      PosterRating: 3,
      LogoRating: 3,
      Comment: '',
      SubmittedAt: '2026-11-11T00:00:00.000Z',
    },
  );

  const evaluations = await getFacultyEvaluationData(faculty);
  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0].evaluatedGroupId, 'g4');
  assert.equal(evaluations[0].overallScore, 4);
  assert.equal(requestCounts.get('getFacultyEvaluationData'), 1);
});

test('rating analytics ranks live records by evaluator source and selected category', () => {
  const evaluations = [
    { evaluatorType: 'student', evaluatedGroupId: 'GROUP-A', ratings: { c1: 4, c2: 3, c3: 5, c4: 4 } },
    { evaluatorType: 'faculty', evaluatedGroupId: 'GROUP-A', ratings: { c1: 2, c2: 5, c3: 4, c4: 5 } },
    { evaluatorType: 'unknown', evaluatedGroupId: 'GROUP-B', ratings: { c1: 5, c2: 4, c3: 4, c4: 4 } },
  ];
  const projects = [
    { groupId: 'GROUP-A', title: 'Group A' },
    { groupId: 'GROUP-B', title: 'Group B' },
  ];

  const combined = summarizeRatings(evaluations, projects);
  assert.equal(combined.evaluationCount, 3);
  assert.equal(combined.categories[0].leaders[0].groupName, 'Group B');
  assert.equal(combined.categories[0].leaders[0].average, 5);
  assert.equal(combined.overallGroups[0].groupName, 'Group B');

  const facultyPitch = summarizeRatings(evaluations, projects, {
    source: 'faculty',
    categoryId: 'c2',
  });
  assert.equal(facultyPitch.evaluationCount, 1);
  assert.equal(facultyPitch.categories.length, 1);
  assert.equal(facultyPitch.categories[0].leaders[0].groupName, 'Group A');
  assert.equal(facultyPitch.categories[0].leaders[0].average, 5);
});

test('rating analytics service rejects non-admin sessions before requesting sheet data', async () => {
  await assert.rejects(
    getAdminRatingAnalytics({ id: currentStudent.id, accountType: 'Faculty', role: 'Admin' }),
    /Only the currently signed-in administrator/,
  );
  assert.equal(requestCounts.get('getRatingAnalytics') || 0, 0);
});

test('evaluation history and status share one authenticated API request', async () => {
  apiEvaluations.push({
    EvaluationID: 'EV-existing',
    StudentID: 's1',
    GroupCode: 'g2',
    ResearchPaperRating: 3,
    PitchVideoRating: 4,
    PosterRating: 5,
    LogoRating: 4,
    Comment: '',
    SubmittedAt: '2026-11-10T00:00:00.000Z',
  });
  apiEvaluations.push({
    EvaluationID: 'EV-new-format',
    StudentID: 's1',
    GroupCode: 'g3',
    ResearchPaperRating: 4,
    PitchVideoRating: 4,
    PosterRating: 4,
    LogoRating: 4,
    Comment: '',
    SubmittedAt: '2026-11-11 12:30:45',
  });
  apiEvaluations.push({
    EvaluationID: 'EV-before-logo-rating',
    StudentID: 's1',
    GroupCode: 'g4',
    ResearchPaperRating: 3,
    PitchVideoRating: 4,
    PosterRating: 5,
    LogoRating: '',
    Comment: '',
    SubmittedAt: '2026-11-12 12:30:45',
  });

  const { evaluations: mine, status } = await getStudentEvaluationData('s1');
  assert.equal(mine[0].overallScore, 4);
  assert.equal(mine[1].submittedAt, '2026-11-11 12:30:45');
  assert.equal(mine[2].ratings.c4, null);
  assert.equal(mine[2].overallScore, 4);
  assert.deepEqual(status, { submitted: 3 });
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

test('Research Paper links from Sheets are exposed under the renamed resource property', async () => {
  apiGroups = [{
    groupCode: 'g2',
    title: 'Paper project',
    researchPaperLink: 'https://example.com/research-paper.pdf',
  }];
  const [project] = await getProjects({ refresh: true });

  assert.equal(project.researchPaperLink, 'https://example.com/research-paper.pdf');
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
    ResearchPaperRating: 4,
    PitchVideoRating: 4,
    PosterRating: 4,
    LogoRating: 4,
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
      ResearchPaperRating: 4,
      PitchVideoRating: 4,
      PosterRating: 4,
      LogoRating: 4,
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
  await assert.rejects(
    submitEvaluation({ evaluatorId: 's1', evaluatedGroupId: 'g4', ratings: { ...validRatings, c4: 6 } }),
    /rate every criterion/,
  );
  apiSettings.CommentMaxLength = '3';
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
    student: { id: 's1', groupId: 'g1', accountType: 'Student' },
    targetGroupId: 'g4',
    existing: [],
    allGroups: [{ id: 'g1' }, { id: 'g4' }],
    settings: { ...initialSettings, evaluationAssignmentMethod: 'assigned' },
  });
  assert.equal(result.canEvaluate, false);
  assert.match(result.reason, /No assignment.*configured/);
});

test('assigned evaluation mode remains enforced by the existing client assignment strategy', async () => {
  apiSettings.EvaluationAssignmentMethod = 'assigned';
  const eligibility = await getEligibility('s1', 'g4');
  assert.equal(eligibility.canEvaluate, false);
  assert.equal(eligibility.code, 'not-assigned');
});

test('database request failures surface instead of falling back to local evaluation data', async () => {
  apiFailure = true;
  await assert.rejects(getEvaluationStatus('s1'), /Database unavailable/);
  assert.equal(entries.has('techcon:evaluations'), false);
  assert.equal(calcOverall(validRatings), 4);

  entries.set('techcon:session', JSON.stringify({ user: currentStudent }));
  await assert.rejects(getEvaluationStatus('s1'), /session has expired/);
});

test('evaluation settings are read from the Google Sheets API', async () => {
  apiSettings = { EvaluationAssignmentMethod: 'Assigned', CommentMaxLength: '250' };
  assert.deepEqual(await getSettings(), {
    ...initialSettings,
    evaluationAssignmentMethod: 'assigned',
    commentMaxLength: 250,
  });
});

test('guest role restricts access to all-projects and blocks evaluations and ratings', async () => {
  const guestUser = { id: 'GUEST-001', accountType: 'Guest', role: 'Guest', name: 'Guest User' };
  assert.equal(isGuest(guestUser), true);
  assert.equal(isStudent(guestUser), false);
  assert.equal(isFaculty(guestUser), false);
  assert.equal(isAdmin(guestUser), false);
  assert.equal(homePathFor(guestUser), '/guest/all-projects');
  assert.equal(basePathFor(guestUser), '/guest');
  assert.equal(canViewRatings(guestUser), false);
  assert.deepEqual(guestNav, [{ to: '/guest/all-projects', label: 'All Projects', icon: guestNav[0].icon }]);

  entries.set('techcon:session', JSON.stringify({ user: guestUser, sessionToken: 'guest-session' }));
  const eligibility = await getEligibility(guestUser.id, 'g2');
  assert.equal(eligibility.canEvaluate, false);
  assert.equal(eligibility.code, 'guest');

  await assert.rejects(
    submitEvaluation({ evaluatorId: guestUser.id, evaluatedGroupId: 'g2', ratings: validRatings, comments: '' }),
    /Only signed-in students and faculty/
  );
});

test('Faculty login with Guest as the identifier is handled as a guest account', async () => {
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    assert.equal(requestBody.role, 'Faculty');
    return response({
      success: true,
      role: 'guest',
      sessionToken: 'guest-session',
      user: { GuestID: 'GUEST-001', FullName: 'Guest User', Role: 'Guest' },
    });
  };

  const user = await login('Guest', 'guest', 'Faculty');

  assert.equal(user.accountType, 'Guest');
  assert.equal(user.role, 'Guest');
  assert.equal(user.id, 'GUEST-001');
});

test('Guest login fails when the authentication service is unavailable', async () => {
  globalThis.fetch = async () => response({ message: 'Database unavailable' }, 503);

  await assert.rejects(login('Guest', 'guest', 'Faculty'), /Database unavailable/);
  assert.equal(entries.has('techcon:session'), true);
  assert.equal(JSON.parse(entries.get('techcon:session')).user.id, 's1');
});

test('faculty login exposes the FacultyID sheet value as facultyId', async () => {
  globalThis.fetch = async () => response({
    success: true,
    role: 'adviser',
    sessionToken: 'faculty-session',
    user: { FacultyID: 'FAC-204', FullName: 'Prof. Faculty', Role: 'Adviser' },
  });

  const user = await login('FAC-204', 'password', 'Faculty');

  assert.equal(user.id, 'FAC-204');
  assert.equal(user.facultyId, 'FAC-204');
});

test('rating visibility is strictly limited to faculty admins', () => {
  const student = { id: 's1', accountType: 'Student', role: 'Student' };
  const adviser = { id: 'f1', accountType: 'Faculty', role: 'Adviser' };
  const admin = { id: 'f3', accountType: 'Faculty', role: 'Admin' };
  const guest = { id: 'g-1', accountType: 'Guest', role: 'Guest' };

  assert.equal(canViewRatings(admin), true);
  assert.equal(canViewRatings(student), false);
  assert.equal(canViewRatings(adviser), false);
  assert.equal(canViewRatings(guest), false);
  assert.equal(canToggleRatings(), false);
  assert.match(ratingsHiddenReason(student), /visible only to system administrators/i);
  assert.match(ratingsHiddenReason(adviser), /visible only to system administrators/i);
  assert.match(ratingsHiddenReason(guest), /visible only to system administrators/i);
});

test('faculty advisers cannot rate their assigned groups but can rate other groups', async () => {
  const adviser = {
    id: 'f1',
    accountType: 'Faculty',
    role: 'Adviser',
    name: 'Prof. Maria Santos',
    assignedGroupIds: ['g1', 'g2'],
  };
  entries.set('techcon:session', JSON.stringify({ user: adviser, sessionToken: 'faculty-session' }));

  // Assigned group: must be blocked
  const assignedEligibility = await getEligibility(adviser.id, 'g1');
  assert.equal(assignedEligibility.canEvaluate, false);
  assert.equal(assignedEligibility.code, 'assigned-team');
  assert.match(assignedEligibility.reason, /Faculty advisers cannot evaluate groups assigned to them/i);

  await assert.rejects(
    submitEvaluation({ evaluatorId: adviser.id, evaluatedGroupId: 'g1', ratings: validRatings, comments: '' }),
    /Faculty advisers cannot evaluate groups assigned to them/i
  );

  // Non-assigned group: must be allowed
  const otherEligibility = await getEligibility(adviser.id, 'g4');
  assert.equal(otherEligibility.canEvaluate, true);
  assert.equal(otherEligibility.code, 'ok');

  const result = await submitEvaluation({
    evaluatorId: adviser.id,
    evaluatedGroupId: 'g4',
    ratings: validRatings,
    comments: 'Great presentation',
  });

  assert.equal(result.evaluatedGroupId, 'g4');
  assert.equal(result.overallScore, 4);
});

test('faculty evaluation submission surfaces Sheets failures without writing local evaluation data', async () => {
  const adviser = {
    id: 'f1',
    accountType: 'Faculty',
    role: 'Adviser',
    name: 'Prof. Maria Santos',
  };
  entries.set('techcon:session', JSON.stringify({ user: adviser, sessionToken: 'faculty-session' }));
  apiFailure = true;

  await assert.rejects(
    submitEvaluation({ evaluatorId: adviser.id, evaluatedGroupId: 'g4', ratings: validRatings }),
    /Database unavailable/,
  );
  assert.equal(entries.has('techcon:evaluations'), false);
});

test('faculty project assignment badges compare string and numeric IDs safely', () => {
  assert.equal(
    isProjectAssignedToFaculty(
      { groupId: 'GROUP-1', facultyId: 1001 },
      { id: 1001, assignedGroupIds: [] },
    ),
    true,
  );
  assert.equal(
    isProjectAssignedToFaculty(
      { groupId: 1002, facultyId: 'Other Adviser' },
      { id: 'FAC-001', name: 'Prof. Current', assignedGroupIds: ['1002'] },
    ),
    true,
  );
  assert.equal(
    isProjectAssignedToFaculty(
      { groupId: 'GROUP-2', facultyId: 1002 },
      { id: 1001, name: 'Prof. Current', assignedGroupIds: [] },
    ),
    false,
  );
});
