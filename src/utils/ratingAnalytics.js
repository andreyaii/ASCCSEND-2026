import { evaluationCriteria } from '../data/settings.js';

const scoreIsValid = (score) => Number.isFinite(score) && score >= 1 && score <= 5;

export function summarizeRatings(evaluations, projects, filters = {}) {
  const { source = 'both', categoryId = 'all', groupId = 'all' } = filters;
  const categories = evaluationCriteria.filter((criterion) => categoryId === 'all' || criterion.id === categoryId);
  const projectByGroup = new Map(projects.map((project) => [
    project.groupId,
    project.group?.groupName || project.title || project.groupId,
  ]));
  const filtered = evaluations.filter((evaluation) => (
    (source === 'both' || evaluation.evaluatorType === source)
    && (groupId === 'all' || evaluation.evaluatedGroupId === groupId)
  ));
  const groupIds = [...new Set(filtered.map((evaluation) => evaluation.evaluatedGroupId))];
  const summarizeCategory = (criterion) => {
    const groups = groupIds.map((id) => {
      const scores = filtered
        .filter((evaluation) => evaluation.evaluatedGroupId === id)
        .map((evaluation) => evaluation.ratings[criterion.id])
        .filter(scoreIsValid);
      if (!scores.length) return null;
      return {
        groupId: id,
        groupName: projectByGroup.get(id) || id,
        average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
        count: scores.length,
      };
    }).filter(Boolean).sort((a, b) => b.average - a.average || a.groupName.localeCompare(b.groupName));
    const bestScore = groups[0]?.average;
    return {
      criterion,
      groups,
      leaders: groups.filter((group) => group.average === bestScore),
    };
  };
  const overallGroups = groupIds.map((id) => {
    const groupEvaluations = filtered.filter((evaluation) => evaluation.evaluatedGroupId === id);
    const categoryAverages = categories.map((criterion) => {
      const scores = groupEvaluations
        .map((evaluation) => evaluation.ratings[criterion.id])
        .filter(scoreIsValid);
      return {
        criterionId: criterion.id,
        average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
        count: scores.length,
      };
    });
    const evaluationScores = groupEvaluations.map((evaluation) => {
      const scores = categories
        .map((criterion) => evaluation.ratings[criterion.id])
        .filter(scoreIsValid);
      return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    }).filter((score) => score !== null);
    if (!evaluationScores.length) return null;
    return {
      groupId: id,
      groupName: projectByGroup.get(id) || id,
      categories: categoryAverages,
      average: evaluationScores.reduce((sum, score) => sum + score, 0) / evaluationScores.length,
      count: evaluationScores.length,
    };
  }).filter(Boolean).sort((a, b) => b.average - a.average || a.groupName.localeCompare(b.groupName));

  return {
    evaluationCount: filtered.length,
    categories: categories.map(summarizeCategory),
    overallGroups,
  };
}
