import apiClient from './client';

export const getSessionAnalytics = async (sessionId) => {
  const response = await apiClient.get(`/analytics/session/${sessionId}`);
  return response.data;
};

export const getStudentAnalytics = async (studentId) => {
  const response = await apiClient.get(`/analytics/student/${encodeURIComponent(studentId)}`);
  return response.data;
};

export const getSessionBehaviorAnalytics = async (sessionId) => {
  const response = await apiClient.get(`/analytics/session/${sessionId}/behavior`);
  return response.data;
};
