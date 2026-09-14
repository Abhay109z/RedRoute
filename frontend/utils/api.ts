const BACKEND_URL = ((import.meta as any).env?.VITE_BACKEND_URL || 'https://redroute-tqew.onrender.com').replace(/\/+$/, '');

/**
 * Returns the proper backend URL for API endpoints.
 * Prepends the backend Render domain ('https://redroute-tqew.onrender.com') to all API calls.
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${cleanPath}`;
}

