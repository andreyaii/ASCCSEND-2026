// ISOLATED assignment logic. The method (free-select vs assigned) is still undecided,
// so everything about "which groups may this student evaluate?" lives only in this file.
// Switch via settings.evaluationAssignmentMethod.

const strategies = {
  // Student freely picks any group except their own.
  'free-select': (student, allGroups) => allGroups.filter((g) => g.id !== student.groupId).map((g) => g.id),
  // Instructor assigns groups per student (student.assignedGroupIds).
  assigned: (student, allGroups) => allGroups.filter((g) => g.id !== student.groupId && student.assignedGroupIds?.includes(g.id)).map((g) => g.id),
};

export function getEligibleGroupIds(student, allGroups, settings) {
  const strategy = strategies[settings.evaluationAssignmentMethod];
  if (!strategy) throw new Error('The evaluation assignment method is not configured.');
  return strategy(student, allGroups);
}

/**
 * Returns { canEvaluate, reason, code } for a student/target pair.
 * `existing` = this student's submitted evaluations.
 */
export function checkEligibility({ student, targetGroupId, existing, allGroups, settings }) {
  if (!student) return { canEvaluate: false, code: 'not-student', reason: 'Only signed-in students can evaluate projects.' };
  if (!allGroups.some((group) => group.id === targetGroupId)) return { canEvaluate: false, code: 'missing-group', reason: 'This project group could not be found.' };
  if (student.groupId === targetGroupId) return { canEvaluate: false, code: 'own-group', reason: 'You cannot evaluate your own group.' };
  if (existing.some((e) => e.evaluatedGroupId === targetGroupId)) return { canEvaluate: false, code: 'duplicate', reason: 'You have already evaluated this group.' };
  if (!getEligibleGroupIds(student, allGroups, settings).includes(targetGroupId)) {
    const reason = settings.evaluationAssignmentMethod === 'assigned'
      ? 'No assignment for this group is configured for you. Contact your instructor.'
      : 'This group is not available for evaluation.';
    return { canEvaluate: false, code: 'not-assigned', reason };
  }
  return { canEvaluate: true, code: 'ok', reason: '' };
}
