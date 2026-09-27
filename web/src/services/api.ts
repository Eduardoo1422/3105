import type { AuthUser, LoginResponse, Category, Feature, Resource, BootstrapResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('swag_admin_token');
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data as T;
}

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function saveSession(session: LoginResponse) {
  localStorage.setItem('swag_admin_token', session.token);
  localStorage.setItem('swag_admin_user', JSON.stringify(session.user));
}

export function getStoredUser(): AuthUser | null {
  const value = localStorage.getItem('swag_admin_user');
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('swag_admin_token');
  localStorage.removeItem('swag_admin_user');
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem('swag_admin_token'));
}

// Admin API Methods
export async function getCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/admin/category');
}

export async function createCategory(data: { name: string; slug: string; enabled: boolean }): Promise<Category> {
  return apiRequest<Category>('/admin/category', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getBootstrap(): Promise<BootstrapResponse> {
  return apiRequest<BootstrapResponse>('/bootstrap');
}

export async function createFeature(data: {
  name: string;
  description: string;
  categoryId: string;
  iconName: string;
  enabled: boolean;
}): Promise<Feature> {
  return apiRequest<Feature>('/admin/feature', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getResources(): Promise<{ resources: Resource[] }> {
  return apiRequest<{ resources: Resource[] }>('/admin/resource');
}

export async function getResourceDetail(id: string): Promise<Resource> {
  return apiRequest<Resource>(`/admin/resource/${id}`);
}

export async function createLicense(data: {
  days: number;
  maxDevices: number;
  notes?: string;
}): Promise<{ keyIdentifier: string; rawSecret: string }> {
  return apiRequest<{ keyIdentifier: string; rawSecret: string }>('/admin/license', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function uploadResource(formData: FormData): Promise<Resource> {
  return apiRequest<Resource>('/admin/resource', {
    method: 'POST',
    body: formData,
  });
}

export function getDownloadUrl(id: string): string {
  const token = localStorage.getItem('swag_admin_token') || '';
  return `${API_URL}/admin/resource/${id}/download?token=${encodeURIComponent(token)}`;
}

export async function downloadResourceFile(id: string, filename: string): Promise<void> {
  const token = localStorage.getItem('swag_admin_token') || '';
  const response = await fetch(`${API_URL}/admin/resource/${id}/download`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to download file');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
