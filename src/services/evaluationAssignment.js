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
 * Returns { canEvaluate, reason, code } for a student or faculty evaluator / target group pair.
 * `existing` = this evaluator's submitted evaluations.
 */
export function checkEligibility({ student, user, targetGroupId, existing = [], allGroups = [], settings }) {
  const evaluator = user || student;
  if (!evaluator) return { canEvaluate: false, code: 'not-authenticated', reason: 'You must sign in to evaluate projects.' };

  // Guests cannot rate or evaluate
  if (evaluator.accountType === 'Guest' || evaluator.role === 'Guest') {
    return { canEvaluate: false, code: 'guest', reason: 'Guests cannot evaluate projects.' };
  }

  if (!allGroups.some((group) => group.id === targetGroupId || group.groupId === targetGroupId)) {
    return { canEvaluate: false, code: 'missing-group', reason: 'This project group could not be found.' };
  }

  if (existing.some((e) => e.evaluatedGroupId === targetGroupId || e.GroupCode === targetGroupId)) {
    return { canEvaluate: false, code: 'duplicate', reason: 'You have already evaluated this group.' };
  }

  // Student checks:
  if (evaluator.accountType === 'Student' || evaluator.role === 'Student') {
    if (evaluator.groupId === targetGroupId) {
      return { canEvaluate: false, code: 'own-group', reason: 'You cannot evaluate your own group.' };
    }
    if (settings && !getEligibleGroupIds(evaluator, allGroups, settings).includes(targetGroupId)) {
      const reason = settings.evaluationAssignmentMethod === 'assigned'
        ? 'No assignment for this group is configured for you. Contact your instructor.'
        : 'This group is not available for evaluation.';
      return { canEvaluate: false, code: 'not-assigned', reason };
    }
  }

  // Faculty Adviser checks:
  if (evaluator.accountType === 'Faculty') {
    const isAssigned = (evaluator.assignedGroupIds && evaluator.assignedGroupIds.includes(targetGroupId)) ||
      allGroups.some((g) => (g.id === targetGroupId || g.groupId === targetGroupId) && (
        (g.facultyId && evaluator.id && String(g.facultyId).toLowerCase() === String(evaluator.id).toLowerCase()) ||
        (g.facultyId && evaluator.name && String(g.facultyId).toLowerCase() === String(evaluator.name).toLowerCase()) ||
        (g.facultyId && evaluator.facultyId && String(g.facultyId).toLowerCase() === String(evaluator.facultyId).toLowerCase())
      ));

    if (isAssigned) {
      return {
        canEvaluate: false,
        code: 'assigned-team',
        reason: 'Faculty advisers cannot evaluate groups assigned to them.'
      };
    }
  }

  return { canEvaluate: true, code: 'ok', reason: '' };
}
