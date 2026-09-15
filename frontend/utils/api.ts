function sanitizeApiUrl(rawUrl?: string, defaultUrl: string = 'https://redroute-tqew.onrender.com'): string {
  if (!rawUrl || typeof rawUrl !== 'string') return defaultUrl;
  let cleaned = rawUrl.trim();
  const mdMatch = cleaned.match(/\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
  if (mdMatch) cleaned = mdMatch[1];
  cleaned = cleaned.replace(/^["'<]+|["'>]+$/g, '');
  cleaned = cleaned.replace(/\/+$/, '');
  if (cleaned.includes('vercel.app')) return defaultUrl;
  return cleaned || defaultUrl;
}

const metaEnv = (import.meta as any).env;
export const API_URL = sanitizeApiUrl(metaEnv?.VITE_API_URL || metaEnv?.VITE_BACKEND_URL);

/**
 * Returns the proper backend URL for API endpoints.
 * Prepends the backend Render domain ('https://redroute-tqew.onrender.com' or VITE_API_URL) to all API calls.
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
}


