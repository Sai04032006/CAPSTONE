import axios from 'axios';

// Get base URL from environment or localStorage override
// Defaults to '/api' to use Vite proxy, avoiding CORS and host mismatch issues
const getBaseUrl = () => {
  const customUrl = localStorage.getItem('smartclassroom_api_url');
  if (customUrl) return customUrl;
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000,
});

// Update base URL dynamically when settings change
export const setApiBaseUrl = (newUrl) => {
  if (newUrl) {
    localStorage.setItem('smartclassroom_api_url', newUrl);
    apiClient.defaults.baseURL = newUrl;
  } else {
    localStorage.removeItem('smartclassroom_api_url');
    apiClient.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
  }
};

export const getApiBaseUrl = () => {
  return apiClient.defaults.baseURL;
};

// Response error interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message;
    if (error.response) {
      message = error.response.data?.detail || error.response.data?.message || `Server Error (${error.response.status})`;
    } else if (error.request) {
      message = 'Cannot connect to backend API server at ' + apiClient.defaults.baseURL;
    } else {
      message = error.message || 'An unexpected network error occurred';
    }
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default apiClient;
