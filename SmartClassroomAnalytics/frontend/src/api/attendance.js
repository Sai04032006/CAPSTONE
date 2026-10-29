import apiClient from './client';

export const getSessionAttendance = async (sessionId) => {
  const response = await apiClient.get(`/attendance/session/${sessionId}`);
  return response.data;
};

export const getStudentAttendance = async (studentId) => {
  const response = await apiClient.get(`/attendance/student/${encodeURIComponent(studentId)}`);
  return response.data;
};

export const recordAttendance = async (attendanceData) => {
  const payload = {
    session_id: Number(attendanceData.session_id),
    student_id: String(attendanceData.student_id).trim(),
    presence_seconds: Number(attendanceData.presence_seconds),
  };
  const response = await apiClient.post('/attendance/', payload);
  return response.data;
};
