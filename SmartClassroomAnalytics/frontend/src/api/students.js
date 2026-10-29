import apiClient from './client';

export const getStudents = async () => {
  const response = await apiClient.get('/students/');
  return response.data;
};

export const getStudent = async (studentId) => {
  const response = await apiClient.get(`/students/${encodeURIComponent(studentId)}`);
  return response.data;
};

export const createStudent = async (studentData) => {
  const response = await apiClient.post('/students/', {
    student_id: studentData.student_id.trim(),
    name: studentData.name.trim(),
    email: studentData.email ? studentData.email.trim() : null,
  });
  return response.data;
};
