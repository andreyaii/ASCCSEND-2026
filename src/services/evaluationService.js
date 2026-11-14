import { evaluationCriteria, RATING_SCALE } from '../data/settings.js';
import { calcOverall } from '../utils/ratings.js';
import { request } from '../config/apiConfig.js';
import { checkEligibility } from './evaluationAssignment.js';
import { getSettings } from './settingsService.js';
import { getCurrentUser } from './authService.js';
import { isAdmin, isFaculty, isGuest, isStudent } from '../utils/roles.js';
import { getProjects } from './projectService.js';

const submissionsInProgress = new Set();

function isValidSubmittedAt(value) {
  const submittedAt = String(value || '');
  const match = submittedAt.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  );

  if (match) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const date = new Date(year, month - 1, day, hour, minute, second);

    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second;
  }

  return Number.isFinite(Date.parse(submittedAt));
}

function requireCurrentStudent(studentId) {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.id !== studentId || !isStudent(currentUser)) {
    throw new Error('Only the currently signed-in student can submit or view their evaluation status.');
  }
  return currentUser;
}

function requireCurrentEvaluator(evaluatorId) {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.id !== evaluatorId || isGuest(currentUser)) {
    throw new Error('Only signed-in students and faculty can submit or view evaluation data.');
  }
  return currentUser;
}

export async function getEvaluationsByEvaluator(evaluatorId) {
  return (await getStudentEvaluationData(evaluatorId)).evaluations;
}

export async function getAdminRatingAnalytics(user) {
  const currentUser = getCurrentUser();
  if (!isAdmin(user) || !isAdmin(currentUser) || currentUser.id !== user.id) {
    throw new Error('Only the currently signed-in administrator can view rating analytics.');
  }

  const response = await request('getRatingAnalytics', { authenticated: true });
  if (!Array.isArray(response.data?.evaluations)) {
    throw new Error('Rating analytics response is invalid.');
  }

  return response.data.evaluations.map((row) => parseEvaluationRow(row, true));
}

function parseEvaluationRow(row, includeEvaluatorType = false) {
  const ratings = parseEvaluationRatings(row);
  const id = String(row.EvaluationID || '').trim();
  const evaluatorId = String(row.StudentID || '').trim();
  const evaluatedGroupId = String(row.GroupCode || '').trim();
  const submittedAt = String(row.SubmittedAt || '');
  const evaluatorType = String(row.EvaluatorType || '');
  if (
    !id
    || !evaluatorId
    || !evaluatedGroupId
    || (includeEvaluatorType && !['student', 'faculty', 'unknown'].includes(evaluatorType))
    || ![ratings.c1, ratings.c2, ratings.c3].every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= RATING_SCALE)
    || (ratings.c4 !== null && (!Number.isInteger(ratings.c4) || ratings.c4 < 1 || ratings.c4 > RATING_SCALE))
    || !isValidSubmittedAt(submittedAt)
  ) {
    throw new Error('Evaluation data contains an invalid record.');
  }
  return {
    id,
    evaluatorId,
    evaluatorType: includeEvaluatorType ? evaluatorType : undefined,
    evaluatedGroupId,
    ratings,
    overallScore: calcOverall(ratings),
    comments: String(row.Comment || ''),
    submittedAt,
  };
}

function parseEvaluationRatings(row) {
  const logoRating = row.LogoRating;
  return {
    c1: Number(row.ResearchPaperRating),
    c2: Number(row.PitchVideoRating),
    c3: Number(row.PosterRating),
    c4: logoRating === '' || logoRating === null || logoRating === undefined
      ? null
      : Number(logoRating),
  };
}

export async function getStudentEvaluationData(evaluatorId) {
  requireCurrentStudent(evaluatorId);
  const response = await request('getStudentEvaluationData', { authenticated: true });
  if (!response.data || !Array.isArray(response.data.evaluations)) {
    throw new Error('Evaluation history response is invalid.');
  }
  const evaluations = response.data.evaluations.map((row) => {
    const ratings = parseEvaluationRatings(row);
    const id = String(row.EvaluationID || '');
    const studentId = String(row.StudentID || '');
    const groupCode = String(row.GroupCode || '');
    const submittedAt = String(row.SubmittedAt || '');
    if (
      !id ||
      !studentId ||
      studentId !== evaluatorId ||
      !groupCode ||
      ![ratings.c1, ratings.c2, ratings.c3].every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= RATING_SCALE) ||
      (ratings.c4 !== null && (!Number.isInteger(ratings.c4) || ratings.c4 < 1 || ratings.c4 > RATING_SCALE)) ||
      !isValidSubmittedAt(submittedAt)
    ) {
      throw new Error('Evaluation history contains an invalid record.');
    }
    return {
      id,
      evaluatorId: studentId,
      evaluatedGroupId: groupCode,
      ratings,
      overallScore: calcOverall(ratings),
      comments: String(row.Comment || ''),
      submittedAt,
    };
  });
  const status = response.data.status;
  validateEvaluationStatus(status);
  return { evaluations, status };
}

export async function getFacultyEvaluationData(user) {
  const currentUser = getCurrentUser();
  if (!isFaculty(user) || !isFaculty(currentUser) || currentUser.id !== user.id) {
    throw new Error('Only the currently signed-in faculty member can view their evaluations.');
  }

  const response = await request('getFacultyEvaluationData', { authenticated: true });
  if (!Array.isArray(response.data?.evaluations)) {
    throw new Error('Faculty evaluation history response is invalid.');
  }
  return response.data.evaluations.map((row) => {
    const evaluation = parseEvaluationRow(row);
    if (evaluation.evaluatorId !== String(user.id)) {
      throw new Error('Faculty evaluation history contains a record for another evaluator.');
    }
    return evaluation;
  });
}

// Raw evaluations received by a group (faculty detail view; includes comments).
export async function getEvaluationsForGroup(groupId, user) {
  const currentUser = getCurrentUser();
  if (!isFaculty(user) || currentUser?.id !== user.id) throw new Error('Only signed-in faculty can view received evaluation details.');
  const response = await request('getEvaluationsForGroup', {
    authenticated: true,
    query: { groupCode: groupId },
  });
  if (!Array.isArray(response.data)) {
    throw new Error('Received evaluation response is invalid.');
  }
  return response.data.map((row) => {
    const evaluation = parseEvaluationRow(row, true);
    if (evaluation.evaluatedGroupId !== groupId) {
      throw new Error('Received evaluation response contains a different group.');
    }
    return {
      ...evaluation,
      evaluatorName: evaluation.evaluatorId,
      evaluatorGroup: evaluation.evaluatorType === 'student' ? 'Student' : 'Faculty',
    };
  });
}

// Aggregates only (no comments, no evaluator identity): safe for student-facing views.
export async function getAggregates(user) {
  if (!isAdmin(user)) return {};
  const evaluations = await getAdminRatingAnalytics(user);
  const map = {};
  evaluations.forEach((evaluation) => {
    const a = (map[evaluation.evaluatedGroupId] ||= { total: 0, count: 0 });
    a.total += evaluation.overallScore;
    a.count += 1;
  });
  return Object.fromEntries(Object.entries(map).map(([id, a]) => [id, { average: a.total / a.count, count: a.count }]));
}

export async function getEligibility(studentId, targetGroupId) {
  const currentUser = getCurrentUser();
  if (!currentUser) return { canEvaluate: false, code: 'not-authenticated', reason: 'Please sign in to evaluate projects.' };
  if (isGuest(currentUser)) return { canEvaluate: false, code: 'guest', reason: 'Guests cannot evaluate projects.' };

  if (isFaculty(currentUser)) {
    if (currentUser.id !== studentId) {
      throw new Error('Only the currently signed-in faculty member can check evaluation eligibility.');
    }
    const [projects, response] = await Promise.all([
      getProjects(),
      request('getEvaluations', { authenticated: true }),
    ]);
    if (!Array.isArray(response.data)) {
      throw new Error('Evaluation response is invalid.');
    }
    const existing = response.data
      .map((evaluation) => parseEvaluationRow(evaluation))
      .filter((evaluation) => evaluation.evaluatorId === studentId);
    return checkEligibility({
      user: currentUser,
      targetGroupId,
      existing,
      allGroups: projects.map((p) => ({ id: p.groupId, groupId: p.groupId, facultyId: p.facultyId })),
    });
  }

  const student = requireCurrentStudent(studentId);
  const response = await request('getEvaluationEligibility', {
    authenticated: true,
    query: { groupCode: targetGroupId },
  });
  const eligibility = response.data;
  if (
    !eligibility ||
    typeof eligibility.canEvaluate !== 'boolean' ||
    typeof eligibility.reason !== 'string' ||
    typeof eligibility.code !== 'string'
  ) {
    throw new Error('Evaluation eligibility response is invalid.');
  }
  validateEvaluationStatus({
    submitted: eligibility.submitted,
    limit: eligibility.limit,
    remaining: eligibility.remaining,
  });
  if (!eligibility.canEvaluate) return eligibility;

  const settings = await getSettings();
  if (settings.evaluationAssignmentMethod === 'assigned') {
    const [projects, existing] = await Promise.all([
      getProjects(),
      getEvaluationsByEvaluator(studentId),
    ]);
    const assignment = checkEligibility({
      student,
      targetGroupId,
      existing,
      allGroups: projects.map((project) => ({ id: project.groupId, groupId: project.groupId, facultyId: project.facultyId })),
      settings,
    });
    if (!assignment.canEvaluate) return { ...eligibility, ...assignment };
  }
  return eligibility;
}

// The backend revalidates eligibility, ratings, comments, and session on every submit.
export async function submitEvaluation({ evaluatorId, evaluatedGroupId, ratings, comments }) {
  const currentUser = requireCurrentEvaluator(evaluatorId);
  if (submissionsInProgress.has(evaluatorId)) throw new Error('An evaluation is already being submitted. Please wait.');
  submissionsInProgress.add(evaluatorId);
  try {
    const settings = await getSettings();
    const check = await getEligibility(evaluatorId, evaluatedGroupId);
    if (!check.canEvaluate) throw new Error(check.reason);
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) throw new Error('Please rate every criterion.');

    const savedRatings = {};
    for (const criterion of evaluationCriteria) {
      const value = ratings[criterion.id];
      if (!Number.isInteger(value) || value < 1 || value > RATING_SCALE) {
        throw new Error('Please rate every criterion from 1 to 5.');
      }
      savedRatings[criterion.id] = value;
    }
    if (comments !== undefined && typeof comments !== 'string') throw new Error('Comments must be text.');
    const cleanedComments = comments?.trim() || '';
    if (cleanedComments.length > settings.commentMaxLength) {
      throw new Error(`Comments must be ${settings.commentMaxLength} characters or fewer.`);
    }

    if (isStudent(currentUser)) requireCurrentStudent(evaluatorId);
    const response = await request('submitEvaluation', {
      method: 'POST',
      authenticated: true,
      body: {
        groupCode: evaluatedGroupId,
        researchPaperRating: savedRatings.c1,
        pitchVideoRating: savedRatings.c2,
        posterRating: savedRatings.c3,
        logoRating: savedRatings.c4,
        comment: cleanedComments,
      },
    });
    if (typeof response.evaluationId !== 'string' || !response.evaluationId.trim()) {
      throw new Error('The server did not confirm the evaluation submission.');
    }
    const submittedAt = String(response.submittedAt || '');
    if (!isValidSubmittedAt(submittedAt)) {
      throw new Error('The server returned an invalid evaluation submission time.');
    }
    return {
      id: response.evaluationId,
      evaluatorId,
      evaluatedGroupId,
      ratings: savedRatings,
      overallScore: calcOverall(savedRatings, evaluationCriteria),
      comments: cleanedComments,
      submittedAt,
    };
  } finally {
    submissionsInProgress.delete(evaluatorId);
  }
}

export async function getEvaluationStatus(studentId) {
  requireCurrentStudent(studentId);
  const response = await request('getEvaluationStatus', { authenticated: true });
  const status = response.data;
  validateEvaluationStatus(status);
  return status;
}

function validateEvaluationStatus(status) {
  if (
    !status ||
    !Number.isInteger(status.submitted) ||
    status.submitted < 0
  ) {
    throw new Error('Evaluation status response is invalid.');
  }
}
