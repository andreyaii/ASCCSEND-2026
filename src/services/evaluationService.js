import { evaluations as seed } from '../data/evaluations.js';
import { groups } from '../data/groups.js';
import { students } from '../data/students.js';
import { evaluationCriteria, RATING_SCALE } from '../data/settings.js';
import { calcOverall } from '../utils/ratings.js';
import { request } from '../config/apiConfig.js';
import { checkEligibility } from './evaluationAssignment.js';
import { getSettings } from './settingsService.js';
import { load, save } from './mockStore.js';
import { getCurrentUser } from './authService.js';
import { isAdmin, isFaculty, isStudent } from '../utils/roles.js';
import { getProjects } from './projectService.js';

const all = () => {
  const evaluations = load('evaluations', seed);
  if (!Array.isArray(evaluations)) throw new Error('Saved evaluations are invalid. Reset the demo data before continuing.');
  const ids = new Set();
  const evaluatedPairs = new Set();
  const legacyFourCriteria = ['c1', 'c2', 'c3', 'c4'].map((id) => ({ id }));
  const legacyFiveCriteria = [...legacyFourCriteria, { id: 'c5' }];
  const valid = evaluations.every((evaluation) => {
    if (!evaluation || typeof evaluation !== 'object'
      || typeof evaluation.id !== 'string'
      || typeof evaluation.evaluatorId !== 'string'
      || !evaluation.evaluatorId.trim()
      || typeof evaluation.evaluatedGroupId !== 'string'
      || !evaluation.evaluatedGroupId.trim()
      || !evaluation.ratings || typeof evaluation.ratings !== 'object'
      || !Number.isFinite(evaluation.overallScore)
      || typeof evaluation.comments !== 'string'
      || !Number.isFinite(Date.parse(evaluation.submittedAt))) return false;
    const pair = `${evaluation.evaluatorId}:${evaluation.evaluatedGroupId}`;
    if (ids.has(evaluation.id) || evaluatedPairs.has(pair)) return false;
    ids.add(evaluation.id);
    evaluatedPairs.add(pair);
    const criteria = Object.hasOwn(evaluation.ratings, 'c5')
      ? legacyFiveCriteria
      : Object.hasOwn(evaluation.ratings, 'c4') ? legacyFourCriteria : evaluationCriteria;
    return criteria.every((criterion) => {
      const rating = evaluation.ratings[criterion.id];
      return Number.isInteger(rating) && rating >= 1 && rating <= RATING_SCALE;
    }) && evaluation.overallScore === calcOverall(evaluation.ratings, criteria);
  });
  if (!valid) throw new Error('Saved evaluation records are invalid. Reset the demo data before continuing.');
  return evaluations;
};
const submissionsInProgress = new Set();

function requireCurrentStudent(studentId) {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.id !== studentId || !isStudent(currentUser)) {
    throw new Error('Only the currently signed-in student can submit or view their evaluation status.');
  }
  return currentUser;
}

function requireDemoAdmin(user) {
  const currentUser = getCurrentUser();
  if (!import.meta.env?.DEV || !isAdmin(user) || currentUser?.id !== user.id) {
    throw new Error('Resetting evaluation data is available only to signed-in administrators in development mode.');
  }
}

export async function getEvaluationsByEvaluator(evaluatorId) {
  return (await getStudentEvaluationData(evaluatorId)).evaluations;
}

export async function getStudentEvaluationData(evaluatorId) {
  requireCurrentStudent(evaluatorId);
  const response = await request('getStudentEvaluationData', { authenticated: true });
  if (!response.data || !Array.isArray(response.data.evaluations)) {
    throw new Error('Evaluation history response is invalid.');
  }
  const evaluations = response.data.evaluations.map((row) => {
    const ratings = {
      c1: Number(row.ProposalRating),
      c2: Number(row.PitchVideoRating),
      c3: Number(row.PosterRating),
    };
    const id = String(row.EvaluationID || '');
    const studentId = String(row.StudentID || '');
    const groupCode = String(row.GroupCode || '');
    const submittedAt = String(row.SubmittedAt || '');
    if (
      !id ||
      !studentId ||
      studentId !== evaluatorId ||
      !groupCode ||
      !Object.values(ratings).every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= RATING_SCALE) ||
      !Number.isFinite(Date.parse(submittedAt))
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

// Raw evaluations received by a group (faculty detail view; includes comments).
export async function getEvaluationsForGroup(groupId, user) {
  const currentUser = getCurrentUser();
  if (!isFaculty(user) || currentUser?.id !== user.id) throw new Error('Only signed-in faculty can view received evaluation details.');
  return all()
    .filter((e) => e.evaluatedGroupId === groupId)
    .map((e) => {
      const s = students.find((x) => x.id === e.evaluatorId);
      return { ...e, evaluatorName: s?.name, evaluatorGroup: groups.find((g) => g.id === s?.groupId)?.groupName };
    });
}

// Aggregates only (no comments, no evaluator identity): safe for student-facing views.
export async function getAggregates() {
  const map = {};
  all().forEach((e) => {
    const a = (map[e.evaluatedGroupId] ||= { total: 0, count: 0 });
    a.total += e.overallScore;
    a.count += 1;
  });
  return Object.fromEntries(Object.entries(map).map(([id, a]) => [id, { average: a.total / a.count, count: a.count }]));
}

export async function getEligibility(studentId, targetGroupId) {
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
      allGroups: projects.map((project) => ({ id: project.groupId })),
      settings,
    });
    if (!assignment.canEvaluate) return { ...eligibility, ...assignment };
  }
  return eligibility;
}

// The backend revalidates eligibility, ratings, comments, and session on every submit.
export async function submitEvaluation({ evaluatorId, evaluatedGroupId, ratings, comments }) {
  requireCurrentStudent(evaluatorId);
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

    requireCurrentStudent(evaluatorId);
    const response = await request('submitEvaluation', {
      method: 'POST',
      authenticated: true,
      body: {
        groupCode: evaluatedGroupId,
        proposalRating: savedRatings.c1,
        pitchVideoRating: savedRatings.c2,
        posterRating: savedRatings.c3,
        comment: cleanedComments,
      },
    });
    if (typeof response.evaluationId !== 'string' || !response.evaluationId.trim()) {
      throw new Error('The server did not confirm the evaluation submission.');
    }
    const submittedAt = String(response.submittedAt || '');
    if (!Number.isFinite(Date.parse(submittedAt))) {
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

export function resetEvaluations(user) {
  requireDemoAdmin(user);
  return save('evaluations', seed, { replaceCorrupt: true });
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
    status.submitted < 0 ||
    status.limit !== 5 ||
    status.remaining !== Math.max(status.limit - status.submitted, 0)
  ) {
    throw new Error('Evaluation status response is invalid.');
  }
}
