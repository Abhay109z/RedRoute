const DEFAULT_REMOTE_BACKEND = 'https://redroute-tqew.onrender.com';

/**
 * Returns the proper backend URL for API endpoints.
 * Automatically resolves to the Render backend when running on static hosts like Vercel.
 */
export function apiUrl(path: string): string {
  const metaEnv = (import.meta as any).env;
  if (metaEnv?.VITE_BACKEND_URL) {
    const base = metaEnv.VITE_BACKEND_URL.replace(/\/+$/, '');
    return `${base}${path.startsWith('/') ? path : '/' + path}`;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vercel.app') || hostname.includes('netlify.app') || hostname.includes('pages.dev')) {
      return `${DEFAULT_REMOTE_BACKEND}${path.startsWith('/') ? path : '/' + path}`;
    }
  }

  return path;
}
