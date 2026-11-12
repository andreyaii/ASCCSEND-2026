import { Users, Compass, ClipboardCheck, UserCircle, LayoutGrid } from 'lucide-react';

export const studentNav = [
  { to: '/student/my-group', label: 'My Group', icon: Users },
  { to: '/student/explore', label: 'Explore Projects', icon: Compass },
  { to: '/student/evaluations', label: 'My Evaluations', icon: ClipboardCheck },
  { to: '/student/profile', label: 'Profile', icon: UserCircle },
];

// Advisers and Admins share this exact navigation.
export const facultyNav = [
  { to: '/faculty/all-projects', label: 'All Projects', icon: LayoutGrid },
  { to: '/faculty/my-teams', label: 'My Teams', icon: Users },
  { to: '/faculty/profile', label: 'Profile', icon: UserCircle },
];

// Guests can only explore All Projects (no My Teams or Profile).
export const guestNav = [
  { to: '/guest/all-projects', label: 'All Projects', icon: LayoutGrid },
];
