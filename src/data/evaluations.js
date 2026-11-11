import { calcOverall } from '../utils/ratings.js';

const ev = (id, evaluatorId, evaluatedGroupId, r, comments, submittedAt) => {
  const ratings = { c1: r[0], c2: r[1], c3: r[2], c4: r[3] };
  const legacyCriteria = ['c1', 'c2', 'c3', 'c4'].map((criterionId) => ({ id: criterionId }));
  return { id, evaluatorId, evaluatedGroupId, ratings, overallScore: calcOverall(ratings, legacyCriteria), comments, submittedAt };
};

// s1 (Juan, Group 01) already has 2 of 5 evaluations for demo purposes.
export const evaluations = [
  ev('e1', 's1', 'g2', [4, 5, 4, 4], 'Very practical idea. The UI was clear.', '2026-10-20T09:15:00Z'),
  ev('e2', 's1', 'g3', [5, 4, 4, 3], 'Great hardware demo; documentation could be more detailed.', '2026-10-21T14:40:00Z'),
  ev('e3', 's4', 'g1', [4, 4, 5, 4], 'Clean design and useful features.', '2026-10-20T10:05:00Z'),
  ev('e4', 's4', 'g3', [5, 5, 4, 4], 'Impressive prototype.', '2026-10-22T11:30:00Z'),
  ev('e5', 's7', 'g1', [3, 4, 4, 4], 'Good start, needs more polish.', '2026-10-21T08:50:00Z'),
  ev('e6', 's7', 'g2', [4, 4, 3, 4], 'Solid work overall.', '2026-10-21T09:10:00Z'),
  ev('e7', 's10', 'g1', [5, 4, 4, 5], 'Strong documentation.', '2026-10-22T13:00:00Z'),
  ev('e8', 's13', 'g4', [4, 3, 4, 4], 'Interesting use of AI.', '2026-10-23T15:20:00Z'),
  ev('e9', 's16', 'g5', [4, 4, 4, 5], 'Addresses a real community need.', '2026-10-23T16:00:00Z'),
  ev('e10', 's19', 'g6', [5, 5, 4, 4], 'Excellent visualization.', '2026-10-24T09:00:00Z'),
];
