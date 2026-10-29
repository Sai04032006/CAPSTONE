import apiClient from './client';

export const getSessionBehavior = async (sessionId) => {
  const response = await apiClient.get(`/behavior/session/${sessionId}`);
  return response.data;
};

export const getStudentBehavior = async (studentId) => {
  const response = await apiClient.get(`/behavior/student/${encodeURIComponent(studentId)}`);
  return response.data;
};

export const createBehaviorEvent = async (behaviorData) => {
  const response = await apiClient.post('/behavior/', behaviorData);
  return response.data;
};
