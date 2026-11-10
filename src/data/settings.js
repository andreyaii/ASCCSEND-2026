export const initialSettings = {
  ratingsVisible: true, // global switch, Admin only
  resultsPublished: false, // students see ratings only after publication
  evaluationAssignmentMethod: 'free-select', // 'free-select' | 'assigned' (pending instructor decision)
  evaluationLimit: 5,
  commentMaxLength: 500,
};

export const evaluationCriteria = [
  { id: 'c1', label: 'Logo', description: 'Rate the project logo’s visual quality and relevance.' },
  { id: 'c2', label: 'Documentation', description: 'Rate the clarity and completeness of the project documentation.' },
  { id: 'c3', label: 'Pitch Video', description: 'Rate the clarity and effectiveness of the project pitch video.' },
  { id: 'c4', label: 'Poster', description: 'Rate the poster’s visual quality and presentation of the project.' },
];
export const RATING_SCALE = 5;
