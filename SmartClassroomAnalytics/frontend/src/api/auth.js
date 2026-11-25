import apiClient from './client';

export const loginTeacher = async ({ teacher_id, password }) => {
  const response = await apiClient.post('/auth/login/teacher', {
    teacher_id: teacher_id.trim(),
    password,
  });
  return response.data;
};

export const loginPrincipal = async ({ username, password }) => {
  const response = await apiClient.post('/auth/login/principal', {
    username: username.trim(),
    password,
  });
  return response.data;
};

export const registerTeacher = async ({ teacher_id, name, email, subject, password }) => {
  const response = await apiClient.post('/auth/register/teacher', {
    teacher_id: teacher_id.trim(),
    name: name.trim(),
    email: email ? email.trim() : null,
    subject: subject ? subject.trim() : 'General',
    password,
  });
  return response.data;
};

export const registerPrincipal = async ({ username, name, email, password }) => {
  const response = await apiClient.post('/auth/register/principal', {
    username: username.trim(),
    name: name ? name.trim() : 'Principal',
    email: email ? email.trim() : null,
    password,
  });
  return response.data;
};

export const getTeachers = async () => {
  const response = await apiClient.get('/auth/teachers');
  return response.data;
};
