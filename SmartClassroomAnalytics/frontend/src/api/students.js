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

export const enrollStudent = async (enrollData) => {
  const payload = {
    student_id: enrollData.student_id.trim(),
    name: enrollData.name.trim(),
    email: enrollData.email ? enrollData.email.trim() : null,
    image: enrollData.image || null,
    images: enrollData.images || null,
    overwrite: Boolean(enrollData.overwrite),
  };
  const response = await apiClient.post('/students/enroll', payload);
  return response.data;
};

export const detectFace = async (imageData) => {
  const response = await apiClient.post('/students/detect-face', {
    image: imageData,
  });
  return response.data;
};

export const getStudentEmbeddingStatus = async (studentId) => {
  const response = await apiClient.get(`/students/${encodeURIComponent(studentId)}/embedding-status`);
  return response.data;
};
