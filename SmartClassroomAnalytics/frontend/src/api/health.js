import apiClient from './client';

export const checkHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const checkRoot = async () => {
  const response = await apiClient.get('/');
  return response.data;
};
