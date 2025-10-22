export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInCredentials {
  email: string;
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

