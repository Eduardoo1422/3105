export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceVersion {
  id: string;
  resourceId: string;
  version: string;
  filename: string;
  storageKey: string;
  fileSize: number;
  sha256: string;
  targetBundleId: string;
  targetRelativePath: string;
  targetFilename: string;
  releaseNotes?: string;
  createdAt: string;
}

export interface Resource {
  id: string;
  featureId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  targetBundleId: string;
  targetRelativePath: string;
  targetFilename: string;
  createdAt: string;
  updatedAt: string;
  feature?: {
    id: string;
    name: string;
  };
  versions?: ResourceVersion[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  iconName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  resources?: Resource[];
}

export interface BootstrapResponse {
  features: Feature[];
}
