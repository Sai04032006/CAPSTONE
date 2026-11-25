import apiClient from './client';

export const getEvaluationMetrics = async () => {
  const response = await apiClient.get('/evaluation/metrics');
  return response.data;
};
