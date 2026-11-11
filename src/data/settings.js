export const initialSettings = {
  ratingsVisible: true, // global switch, Admin only
  resultsPublished: false, // students see ratings only after publication
  evaluationAssignmentMethod: 'free-select', // 'free-select' | 'assigned' (pending instructor decision)
  evaluationLimit: 5,
  commentMaxLength: 500,
};

export const evaluationCriteria = [
  { id: 'c1', label: 'Proposal', description: 'Rate the project proposal’s clarity, relevance, and feasibility.' },
  { id: 'c2', label: 'Pitch Video', description: 'Rate the clarity and effectiveness of the project pitch video.' },
  { id: 'c3', label: 'Poster', description: 'Rate the poster’s visual quality and presentation of the project.' },
];
export const RATING_SCALE = 5;
