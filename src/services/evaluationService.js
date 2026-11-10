import { evaluations as seed } from '../data/evaluations.js';
import { groups } from '../data/groups.js';
import { students } from '../data/students.js';
import { evaluationCriteria, RATING_SCALE } from '../data/settings.js';
import { calcOverall } from '../utils/ratings.js';
import { checkEligibility } from './evaluationAssignment.js';
import { getSettings } from './settingsService.js';
import { delay, load, save } from './mockStore.js';
import { getCurrentUser } from './authService.js';
import { isAdmin, isFaculty, isStudent } from '../utils/roles.js';
import { getProjects } from './projectService.js';

const all = () => {
  const evaluations = load('evaluations', seed);
  if (!Array.isArray(evaluations)) throw new Error('Saved evaluations are invalid. Reset the demo data before continuing.');
  const ids = new Set();
  const evaluatedPairs = new Set();
  const legacyCriteria = [...evaluationCriteria, { id: 'c5' }];
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
      ? legacyCriteria
      : evaluationCriteria;
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
  requireCurrentStudent(evaluatorId);
  await delay();
  return all().filter((e) => e.evaluatorId === evaluatorId);
}

// Raw evaluations received by a group (faculty detail view; includes comments).
export async function getEvaluationsForGroup(groupId, user) {
  const currentUser = getCurrentUser();
  if (!isFaculty(user) || currentUser?.id !== user.id) throw new Error('Only signed-in faculty can view received evaluation details.');
  await delay();
  return all()
    .filter((e) => e.evaluatedGroupId === groupId)
    .map((e) => {
      const s = students.find((x) => x.id === e.evaluatorId);
      return { ...e, evaluatorName: s?.name, evaluatorGroup: groups.find((g) => g.id === s?.groupId)?.groupName };
    });
}

// Aggregates only (no comments, no evaluator identity): safe for student-facing views.
export async function getAggregates() {
  await delay();
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
  await delay(50);
  const projects = await getProjects();
  const settings = await getSettings();
  const existing = all().filter((e) => e.evaluatorId === studentId);
  return {
    ...checkEligibility({
      student,
      targetGroupId,
      existing,
      allGroups: projects.map((project) => ({ id: project.groupId })),
      settings,
    }),
    submitted: existing.length,
    limit: settings.evaluationLimit,
    remaining: Math.max(settings.evaluationLimit - existing.length, 0),
  };
}

// Eligibility, ratings, comments, and current session are revalidated on every submit.
export async function submitEvaluation({ evaluatorId, evaluatedGroupId, ratings, comments }) {
  const student = requireCurrentStudent(evaluatorId);
  if (submissionsInProgress.has(evaluatorId)) throw new Error('An evaluation is already being submitted. Please wait.');
  submissionsInProgress.add(evaluatorId);
  try {
    await delay(300);
    const projects = await getProjects();
    const settings = await getSettings();
    const list = all();
    const check = checkEligibility({
      student,
      targetGroupId: evaluatedGroupId,
      existing: list.filter((e) => e.evaluatorId === evaluatorId),
      allGroups: projects.map((project) => ({ id: project.groupId })),
      settings,
    });
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

    const evaluation = {
      id: `e${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      evaluatorId,
      evaluatedGroupId,
      ratings: savedRatings,
      overallScore: calcOverall(savedRatings, evaluationCriteria),
      comments: cleanedComments,
      submittedAt: new Date().toISOString(),
    };
    requireCurrentStudent(evaluatorId);
    save('evaluations', [...list, evaluation]);
    return evaluation;
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
  await delay(50);
  const settings = await getSettings();
  const submitted = all().filter((e) => e.evaluatorId === studentId).length;
  return { submitted, limit: settings.evaluationLimit, remaining: Math.max(settings.evaluationLimit - submitted, 0) };
}
