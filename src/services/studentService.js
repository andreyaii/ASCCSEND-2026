import { students } from '../data/students';
import { delay } from './mockStore';

export async function getStudentById(id) {
  await delay(50);
  return students.find((s) => s.id === id) || null;
}

export async function getStudents() {
  await delay();
  return students;
}
