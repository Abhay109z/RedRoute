const metaEnv = (import.meta as any).env;
export const API_URL = (metaEnv?.VITE_API_URL || metaEnv?.VITE_BACKEND_URL || 'https://redroute-tqew.onrender.com').replace(/\/+$/, '');

/**
 * Returns the proper backend URL for API endpoints.
 * Prepends the backend Render domain ('https://redroute-tqew.onrender.com' or VITE_API_URL) to all API calls.
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
}


