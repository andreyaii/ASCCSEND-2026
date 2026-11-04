const adviserByGroup = { g1: ['f1'], g2: ['f1'], g3: ['f1'], g4: ['f2'], g5: ['f2'], g6: ['f2'], g7: ['f3'], g8: ['f3'] };

export const groups = Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  return {
    id: `g${n}`,
    groupName: `Group ${String(n).padStart(2, '0')}`,
    projectId: `p${n}`,
    memberIds: [`s${i * 3 + 1}`, `s${i * 3 + 2}`, `s${i * 3 + 3}`],
    adviserIds: adviserByGroup[`g${n}`],
  };
});
