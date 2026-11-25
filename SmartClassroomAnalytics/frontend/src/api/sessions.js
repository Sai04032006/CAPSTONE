import apiClient from './client';

export const getSessions = async (teacherId = null) => {
  const url = teacherId ? `/sessions/?teacher_id=${encodeURIComponent(teacherId)}` : '/sessions/';
  const response = await apiClient.get(url);
  return response.data;
};

export const getActiveSession = async (teacherId = null) => {
  try {
    const url = teacherId ? `/sessions/active?teacher_id=${encodeURIComponent(teacherId)}` : '/sessions/active';
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getSession = async (sessionId) => {
  const response = await apiClient.get(`/sessions/${sessionId}`);
  return response.data;
};

export const createSession = async (sessionData) => {
  const payload = {
    subject: sessionData.subject?.trim() || null,
    duration_minutes: Number(sessionData.duration_minutes) || 50,
    teacher_id: sessionData.teacher_id ? String(sessionData.teacher_id).trim() : null,
    teacher_name: sessionData.teacher_name ? sessionData.teacher_name.trim() : null,
  };
  const response = await apiClient.post('/sessions/', payload);
  return response.data;
};

export const endSession = async (sessionId) => {
  const response = await apiClient.post(`/sessions/${sessionId}/end`);
  return response.data;
};

export const getTrackerStatus = async () => {
  const response = await apiClient.get('/sessions/tracker/status');
  return response.data;
};

export const startTracker = async (sessionId) => {
  const response = await apiClient.post(`/sessions/${sessionId}/tracker/start`);
  return response.data;
};

export const stopTracker = async (sessionId) => {
  const response = await apiClient.post(`/sessions/${sessionId}/tracker/stop`);
  return response.data;
};

