export interface User {
  id: string;
  email: string | null; // deprecated in projectless custom auth
  displayName: string | null;
  isAnonymous: boolean;
  createdAt: string;
  lastLoginAt: string;
  username?: string | null;
  role?: 'user' | 'admin';
  isPartner?: boolean; // Partner users get edit/delete permissions
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface SignUpCredentials {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignInCredentials {
  email?: string; // deprecated
  username?: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  clearError: () => void;
  // Impersonation functionality
  isImpersonating: boolean;
  impersonatedUser: User | null;
  originalAdminUser: User | null;
  setImpersonatedUser: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
}

