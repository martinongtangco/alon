let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Uses the Vite proxy to route /api to localhost:3000
  const response = await fetch(`/api/v1/admin${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // We let the AuthContext handle 401s (e.g., by attempting a refresh or logging out)
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    let errMessage = `API Error: ${response.status}`;
    try {
      const errData = await response.json();
      errMessage = errData.error || errMessage;
    } catch {
      // Not JSON
    }
    throw new Error(errMessage);
  }

  // Some endpoints (like logout) might return 204 or empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return null;
};
