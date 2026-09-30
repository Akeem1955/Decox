import { getIdToken } from './authService';

// Live Google Cloud Run backend endpoint
const CLOUD_RUN_URL = 'https://decox-backend-871640164960.us-central1.run.app';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  CLOUD_RUN_URL;

/**
 * Resolve relative image paths and sanitize localhost/127.0.0.1 to full public URLs
 */
export function resolveImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;

  // Map GCS direct URLs to Cloud Run static proxy so mobile Fresco/OkHttp loads 100% reliably
  if (url.includes('storage.googleapis.com/decox-media/')) {
    const path = url.split('storage.googleapis.com/decox-media/')[1];
    return `${BASE_URL}/static/${path}`;
  }

  // Handle accidental backend 127.0.0.1 or localhost links
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    if (url.includes('/static/')) {
      const path = url.split('/static/')[1];
      return `${BASE_URL}/static/${path}`;
    }
    return url.replace(/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/, BASE_URL);
  }

  // Handle relative static paths
  if (url.startsWith('/static/')) {
    return `${BASE_URL}${url}`;
  }

  return url;
}

/**
 * Authenticated API client that auto-attaches Firebase ID token.
 */
async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();
  const isPublic = path.startsWith('/api/feed') || path.startsWith('/api/search');
  if (!token && !isPublic) {
    throw new Error('Not authenticated — no Firebase ID token available');
  }

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// ============================================================================
// AUTH & USER
// ============================================================================

export function registerUser(data: {
  name: string;
  interests?: string[];
  styles?: string[];
}) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getProfile() {
  return request('/api/user/profile');
}

export function updatePreferences(data: {
  interests?: string[];
  styles?: string[];
}) {
  return request('/api/user/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// STORAGE (GCS signed URLs)
// ============================================================================

export function getUploadUrl(data: {
  filename: string;
  content_type?: string;
  folder?: string;
}) {
  return request('/api/upload/signed-url', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Upload a file directly to GCS using a signed URL.
 */
export async function uploadToGcs(
  signedUrl: string,
  fileUri: string,
  contentType: string = 'image/jpeg'
): Promise<void> {
  const response = await fetch(fileUri);
  const blob = await response.blob();

  await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
}

// ============================================================================
// FEED
// ============================================================================

export function getAiRedesignsFeed(page: number = 1, limit: number = 20) {
  return request(`/api/feed/ai-redesigns?page=${page}&limit=${limit}`);
}

export function getArtisanFeed(page: number = 1, limit: number = 20) {
  return request(`/api/feed/artisan?page=${page}&limit=${limit}`);
}

export function searchContent(query: string = '', category: string = '', limit: number = 30) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category && category !== 'All') params.set('category', category);
  params.set('limit', String(limit));
  return request(`/api/search?${params.toString()}`);
}

// ============================================================================
// DESIGNS
// ============================================================================

export function saveDesign(data: {
  route: string;
  prompt: string;
  originalImageUrl?: string;
  mockupImageUrl?: string;
  shoppingList?: any[];
  actionCard?: any;
  spaceType?: string;
  stylePref?: string;
  estimatedTotalNaira?: number;
  matchedArtisan?: any;
  isPublic?: boolean;
}) {
  return request('/api/designs/save', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function publishDesign(designId: string) {
  return request(`/api/designs/${designId}/publish`, { method: 'PUT' });
}

export function getMyDesigns() {
  return request('/api/designs/mine');
}

// ============================================================================
// ARTISAN
// ============================================================================

export function getArtisanProfile(artisanId: string) {
  return request(`/api/artisan/${artisanId}`);
}

export function verifyArtisanImage(data: { image: string }) {
  return request('/api/artisan/verify-image', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function submitArtisanWork(data: {
  imageUrl: string;
  title: string;
  description: string;
  category: string;
  estimatedCostNaira?: number;
}) {
  return request('/api/artisan/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// CONCIERGE (AI EDITING PIPELINE)
// ============================================================================

export function runConcierge(data: {
  prompt: string;
  roomImage?: string;
  spaceType?: string;
  preferredStore?: string;
  messages?: any[];
}) {
  return request('/api/concierge', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
