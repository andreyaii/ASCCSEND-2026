export const initialSettings = {
  ratingsVisible: true, // global switch, Admin only
  resultsPublished: false, // students see ratings only after publication
  evaluationAssignmentMethod: 'free-select', // 'free-select' | 'assigned' (pending instructor decision)
  evaluationLimit: 5,
  commentMaxLength: 500,
};

// PLACEHOLDER criteria: replace labels/descriptions once the instructor finalizes them.
export const evaluationCriteria = [
  { id: 'c1', label: 'Criterion 1 (placeholder)', description: 'Replace with final criterion, e.g. innovation.' },
  { id: 'c2', label: 'Criterion 2 (placeholder)', description: 'Replace with final criterion, e.g. technical quality.' },
  { id: 'c3', label: 'Criterion 3 (placeholder)', description: 'Replace with final criterion, e.g. usability.' },
  { id: 'c4', label: 'Criterion 4 (placeholder)', description: 'Replace with final criterion, e.g. documentation.' },
  { id: 'c5', label: 'Criterion 5 (placeholder)', description: 'Replace with final criterion, e.g. presentation.' },
];
export const RATING_SCALE = 5;
