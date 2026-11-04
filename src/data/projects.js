const mk = (n, title, category, description) => ({
  id: `p${n}`,
  groupId: `g${n}`,
  title,
  description,
  category,
  proposalUrl: null,
  pitchVideoUrl: null,
  documentationUrl: null,
  imageUrl: null, // null renders a placeholder thumbnail
});

export const projects = [
  mk(1, 'CampusConnect: Student Services Portal', 'Web App', 'A unified portal where students request documents, book consultations, and track clearance status without queuing at the registrar.'),
  mk(2, 'SariSmart Inventory Assistant', 'Mobile App', 'A mobile inventory and sales tracker for neighborhood sari-sari stores with low-stock alerts and simple daily summaries.'),
  mk(3, 'AgriSense Soil Monitoring', 'IoT', 'Low-cost soil moisture and temperature sensors that report to a dashboard so small farmers can schedule irrigation.'),
  mk(4, 'StudyBuddy AI Reviewer', 'AI / ML', 'Generates practice quizzes and summaries from uploaded lecture notes to help students prepare for exams.'),
  mk(5, 'BarangayWatch Incident Reporter', 'Web App', 'Residents submit and track community concerns while barangay officials triage and respond through a shared dashboard.'),
  mk(6, 'Dagat: Marine Trash Tracker', 'Data & Analytics', 'Crowdsourced coastal cleanup reports visualized on a map to help local groups prioritize cleanup sites.'),
  mk(7, 'QuestBound Learning Game', 'Game', 'A 2D role-playing game that turns programming fundamentals into quests, with progress saved per student.'),
  mk(8, 'SafeRide Commuter Companion', 'Mobile App', 'Shares jeepney route information and lets commuters send a trusted contact their trip status in real time.'),
];
