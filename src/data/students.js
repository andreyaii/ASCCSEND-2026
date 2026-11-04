const names = [
  'Juan Dela Cruz', 'Maria Clara Reyes', 'Carlo Bautista',
  'Angela Mercado', 'Paolo Garcia', 'Sofia Navarro',
  'Miguel Torres', 'Isabel Ramos', 'Rafael Aquino',
  'Bianca Flores', 'Gabriel Santiago', 'Katrina Villareal',
  'Daniel Castillo', 'Patricia Lim', 'Joshua Tan',
  'Nicole Domingo', 'Adrian Salazar', 'Camille Pascual',
  'Jerome Valdez', 'Hannah Soriano', 'Kevin Mendoza',
  'Lara Cabrera', 'Marco Fernandez', 'Trisha Gutierrez',
];

// 24 students, 3 per group (s1-s3 => g1, s4-s6 => g2, ...)
export const students = names.map((name, i) => ({
  id: `s${i + 1}`,
  studentId: `2023-${String(1001 + i)}`,
  name,
  email: i === 0 ? 'student@techcon.edu' : `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.')}@student.techcon.edu`,
  accountType: 'Student',
  groupId: `g${Math.floor(i / 3) + 1}`,
  assignedGroupIds: [], // used only when evaluationAssignmentMethod = 'assigned'
}));
