import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthContextType, User, SignUpCredentials, SignInCredentials } from '../types/auth';
import bcrypt from 'bcryptjs';
import { supabase, isOfflineMode } from '../lib/supabase';
import { generateId } from '../utils/helpers';
import { saveRecentLogin } from '../utils/recentLogins';
import { saveCredential } from '../utils/savedCredentials';
import { db } from '../services/database';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'gull-auth-user';
const IMPERSONATION_KEY = 'gull-admin-impersonation';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUserState] = useState<User | null>(null);
  const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for impersonation state first
        const impersonationData = localStorage.getItem(IMPERSONATION_KEY);
        if (impersonationData) {
          const { impersonatedUserId, originalAdmin } = JSON.parse(impersonationData);
          try {
            const impersonatedUserData = await db.getProfileByUserId(impersonatedUserId);
            if (impersonatedUserData) {
              const impersonatedUser: User = {
                id: impersonatedUserData.user_id,
                email: impersonatedUserData.email,
                displayName: impersonatedUserData.display_name,
                isAnonymous: false,
                createdAt: impersonatedUserData.created_at || new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };
              setImpersonatedUserState(impersonatedUser);
              setOriginalAdminUser(originalAdmin);
              setIsImpersonating(true);
              setUser(impersonatedUser);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.warn('Failed to restore impersonation state:', error);
            localStorage.removeItem(IMPERSONATION_KEY);
          }
        }

        if (isOfflineMode()) {
          // Load user from localStorage in offline mode
          const storedUser = localStorage.getItem(STORAGE_KEY);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        } else if (supabase) {
          // First, try to load from localStorage (for app_users custom auth)
          const storedUser = localStorage.getItem(STORAGE_KEY);
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            // Restore user immediately from localStorage for better UX
            setUser(parsedUser);
            
            // Verify the user still exists in app_users table (async, non-blocking)
            // Don't sign out on network errors - only sign out if user is actually inactive/deleted
            const verifyUser = async () => {
              try {
                const { data: appUser, error: fetchError } = await supabase
                  .from('app_users')
                  .select('id, username, full_name, role, is_active, is_partner, email')
                  .eq('id', parsedUser.id)
                  .single();

                if (appUser && !fetchError && appUser.is_active) {
                  // User exists and is active, update session with latest data
                  const authUser: User = {
                    id: appUser.id,
                    email: appUser.email || null,
                    displayName: appUser.full_name,
                    username: appUser.username,
                    role: appUser.role,
                    isPartner: appUser.is_partner || false,
                    isAnonymous: false,
                    createdAt: parsedUser.createdAt || new Date().toISOString(),
                    lastLoginAt: new Date().toISOString(),
                  };
                  setUser(authUser);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
                } else if (appUser && !appUser.is_active) {
                  // User is inactive - only then clear session
                  console.warn('User account is inactive, signing out');
                  setUser(null);
                  localStorage.removeItem(STORAGE_KEY);
                } else if (fetchError && fetchError.code === 'PGRST116') {
                  // User not found in database - clear session
                  console.warn('User not found in database, signing out');
                  setUser(null);
                  localStorage.removeItem(STORAGE_KEY);
                }
                // If there's a network error or other error, keep the user logged in
                // This prevents accidental sign-outs due to temporary network issues
              } catch (error) {
                console.warn('Failed to verify app_users session (keeping user logged in):', error);
                // Don't sign out on errors - keep user logged in from localStorage
              }
            };
            
            // Verify in background, don't block initialization
            verifyUser();
            setLoading(false);
            return; // Exit early, session restored from localStorage
          }

          // If no app_users session, check for Supabase Auth session
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (session?.user && !sessionError) {
              const authUser: User = {
                id: session.user.id,
                email: session.user.email || null,
                displayName: session.user.user_metadata?.displayName || null,
                isAnonymous: session.user.is_anonymous || false,
                createdAt: session.user.created_at || new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };
              setUser(authUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
              saveRecentLogin(authUser); // Save to recent logins
            }
          } catch (error) {
            console.warn('Failed to get Supabase session (non-critical):', error);
            // Don't sign out on session fetch errors
          }

          // Listen for auth changes - but don't sign out on SIGNED_OUT events if we have localStorage
          supabase.auth.onAuthStateChange((event: any, session: any) => {
            if (session?.user) {
              const authUser: User = {
                id: session.user.id,
                email: session.user.email || null,
                displayName: session.user.user_metadata?.displayName || null,
                isAnonymous: session.user.is_anonymous || false,
                createdAt: session.user.created_at || new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };
              setUser(authUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
              saveRecentLogin(authUser); // Save to recent logins
            } else if (event === 'SIGNED_OUT') {
              // Only sign out if it's an explicit sign out, not a token expiration
              // Check if we have a stored user - if yes, keep them logged in
              const storedUser = localStorage.getItem(STORAGE_KEY);
              if (!storedUser) {
                // No stored user, safe to sign out
                setUser(null);
                localStorage.removeItem(STORAGE_KEY);
              } else {
                // We have a stored user, keep them logged in
                // This handles cases where Supabase session expires but user should stay logged in
                console.log('Supabase session expired, but keeping user logged in from localStorage');
              }
            } else if (event === 'TOKEN_REFRESHED') {
              // Token refreshed successfully, update session
              if (session?.user) {
                const authUser: User = {
                  id: session.user.id,
                  email: session.user.email || null,
                  displayName: session.user.user_metadata?.displayName || null,
                  isAnonymous: session.user.is_anonymous || false,
                  createdAt: session.user.created_at || new Date().toISOString(),
                  lastLoginAt: new Date().toISOString(),
                };
                setUser(authUser);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
              }
            }
          });
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Failed to initialize authentication');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Periodic session validation - runs every 5 minutes to keep session fresh
  // but doesn't sign out on failures
  useEffect(() => {
    if (!supabase || isOfflineMode()) return;

    const sessionValidationInterval = setInterval(async () => {
      try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        if (!storedUser) return;

        const parsedUser = JSON.parse(storedUser);
        
        // Silently validate user in background
        const { data: appUser, error: fetchError } = await supabase
          .from('app_users')
          .select('id, username, full_name, role, is_active, is_partner, email')
          .eq('id', parsedUser.id)
          .single();

        if (appUser && !fetchError && appUser.is_active) {
          // User is still valid, update with latest data
          const authUser: User = {
            id: appUser.id,
            email: appUser.email || null,
            displayName: appUser.full_name,
            username: appUser.username,
            role: appUser.role,
            isPartner: appUser.is_partner || false,
            isAnonymous: false,
            createdAt: parsedUser.createdAt || new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };
          setUser(authUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        } else if (appUser && !appUser.is_active) {
          // User is inactive - only then sign out
          console.warn('User account is inactive, signing out');
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        } else if (fetchError && fetchError.code === 'PGRST116') {
          // User not found - sign out
          console.warn('User not found in database, signing out');
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
        // Network errors are ignored - user stays logged in
      } catch (error) {
        // Silently ignore validation errors - don't sign out on temporary issues
        console.debug('Session validation error (non-critical):', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(sessionValidationInterval);
    };
  }, []);

  const signUp = async (credentials: SignUpCredentials) => {
    setLoading(true);
    setError(null);
    
    try {
      if (isOfflineMode()) {
        // Create offline user
        const newUser: User = {
          id: generateId(),
          email: credentials.email,
          displayName: credentials.fullName,
          username: credentials.username,
          role: 'user',
          isAnonymous: false,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        setUser(newUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      } else if (supabase) {
        // Hash password
        const passwordHash = await bcrypt.hash(credentials.password, 10);
        
        // Create user in app_users table
        const { data, error: signUpError } = await supabase
          .from('app_users')
          .insert({
            username: credentials.username,
            password_hash: passwordHash,
            full_name: credentials.fullName,
            email: credentials.email,
            role: 'user',
            is_active: true,
          })
          .select()
          .single();

        if (signUpError) {
          if (signUpError.code === '23505') {
            throw new Error('Username already exists');
          }
          throw signUpError;
        }

        if (data) {
          const authUser: User = {
            id: data.id,
            email: credentials.email,
            displayName: credentials.fullName,
            username: credentials.username,
            role: 'user',
            isAnonymous: false,
            createdAt: data.created_at || new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };
          setUser(authUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
          saveRecentLogin(authUser);
          saveCredential(credentials.username, credentials.password);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (credentials: SignInCredentials) => {
    setLoading(true);
    setError(null);
    
    try {
      // Custom username/password auth using app_users
      if (supabase && !isOfflineMode()) {
        // Try to find user by username first, then by email
        let { data, error: fetchError } = await supabase
          .from('app_users')
          .select('id, username, full_name, role, password_hash, is_active, is_partner, email')
          .eq('username', credentials.username)
          .single();

        // If not found by username, try by email
        if (fetchError && credentials.username?.includes('@')) {
          const { data: emailData, error: emailError } = await supabase
            .from('app_users')
            .select('id, username, full_name, role, password_hash, is_active, is_partner, email')
            .eq('email', credentials.username)
            .single();
          
          if (emailData) {
            data = emailData;
            fetchError = null;
          } else {
            fetchError = emailError;
          }
        }

        if (fetchError || !data) {
          // Fallback: allow local admin override if DB not reachable or row missing
          if ((credentials.username === 'gullbaba' || credentials.username === 'gullbaba@gmail.com') && credentials.password === 'gull918786') {
            const authUser: User = {
              id: 'offline-admin',
              email: 'gullbaba@gmail.com',
              displayName: 'GULL BABA',
              username: 'gullbaba',
              role: 'admin',
              isAnonymous: false,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            } as any;
            setUser(authUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
            saveRecentLogin(authUser);
            saveCredential('gullbaba', credentials.password);
            return;
          }
          throw new Error('Invalid credentials');
        }
        if (!data.is_active) throw new Error('Account is inactive');

        const ok = await bcrypt.compare(credentials.password, data.password_hash);
        if (!ok) throw new Error('Invalid credentials');

        const authUser: User = {
          id: data.id,
          email: data.email || null,
          displayName: data.full_name,
          username: data.username,
          role: data.role,
          isPartner: data.is_partner || false,
          isAnonymous: false,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        setUser(authUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        saveRecentLogin(authUser);
        saveCredential(data.username, credentials.password);
      } else {
        // Offline fallback: prefer admin override if known credentials
        if ((credentials.username === 'gullbaba' || credentials.username === 'gullbaba@gmail.com') && credentials.password === 'gull918786') {
          const authUser: User = {
            id: 'offline-admin',
            email: 'gullbaba@gmail.com',
            displayName: 'GULL BABA',
            username: 'gullbaba',
            role: 'admin',
            isAnonymous: false,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          } as any;
          setUser(authUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
          saveRecentLogin(authUser);
          saveCredential('gullbaba', credentials.password);
        } else {
          // Accept any user as regular user in offline mode
          const authUser: User = {
            id: 'offline-user',
            email: null,
            displayName: credentials.username || 'User',
            username: credentials.username || 'user',
            role: 'user',
            isAnonymous: false,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          } as any;
          setUser(authUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const signInAnonymously = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const anonymousUser: User = {
        id: generateId(),
        email: null,
        displayName: 'Guest User',
        isAnonymous: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      if (isOfflineMode()) {
        // Always create anonymous user in offline mode
        setUser(anonymousUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(anonymousUser));
      } else if (supabase) {
        // Try Supabase anonymous sign in (if supported)
        try {
          const { data, error: anonError } = await supabase.auth.signInAnonymously();
          
          if (anonError) throw anonError;

          if (data.user) {
            const authUser: User = {
              id: data.user.id,
              email: null,
              displayName: 'Guest User',
              isAnonymous: true,
              createdAt: data.user.created_at || new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };
            setUser(authUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
          }
        } catch {
          // Fallback to local anonymous user if Supabase doesn't support it
          setUser(anonymousUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(anonymousUser));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Anonymous sign in failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Exit impersonation if active
      if (isImpersonating) {
        await exitImpersonation();
      }
      
      if (supabase && !isOfflineMode()) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn('Supabase sign out error (non-critical):', err);
          // Continue with local sign out even if Supabase fails
        }
      }
      
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_KEY);
      
      // Clear all project data (optional - you might want to keep local data)
      // localStorage.clear();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (displayName: string) => {
    if (!user) throw new Error('No user logged in');
    
    setLoading(true);
    setError(null);
    
    try {
      const updatedUser = { ...user, displayName };

      if (isOfflineMode()) {
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      } else if (supabase) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { displayName },
        });

        if (updateError) throw updateError;
        
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile update failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  // Impersonation functions
  const setImpersonatedUser = async (userId: string) => {
    console.log('🔍 setImpersonatedUser called with userId:', userId);
    try {
      const profile = await db.getProfileByUserId(userId);
      console.log('📊 Profile found:', profile);
      if (!profile) {
        throw new Error('User not found');
      }

      const impersonatedUser: User = {
        id: profile.user_id,
        email: profile.email,
        displayName: profile.display_name,
        isAnonymous: false,
        createdAt: profile.created_at || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      console.log('👤 Impersonated user object:', impersonatedUser);

      setOriginalAdminUser(user);
      setImpersonatedUserState(impersonatedUser);
      setIsImpersonating(true);
      setUser(impersonatedUser);

      // Store impersonation state
      localStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
        impersonatedUserId: userId,
        originalAdmin: user
      }));

      console.log('✅ Impersonation state set successfully');

      // Log admin action
      if (user) {
        await db.logAdminAction(
          user.id,
          userId,
          'impersonate',
          `Admin started impersonating user: ${impersonatedUser.displayName || impersonatedUser.email}`,
          {
            impersonatedUserEmail: impersonatedUser.email,
            impersonatedUserDisplayName: impersonatedUser.displayName
          }
        );
        console.log('📝 Admin action logged');
      }
    } catch (error) {
      console.error('❌ Failed to impersonate user:', error);
      throw error;
    }
  };

  const exitImpersonation = async () => {
    if (originalAdminUser && impersonatedUser) {
      // Log admin action
      await db.logAdminAction(
        originalAdminUser.id,
        impersonatedUser.id,
        'exit_impersonation',
        `Admin stopped impersonating user: ${impersonatedUser.displayName || impersonatedUser.email}`,
        {
          impersonatedUserEmail: impersonatedUser.email,
          impersonatedUserDisplayName: impersonatedUser.displayName
        }
      );

      setUser(originalAdminUser);
      setImpersonatedUserState(null);
      setOriginalAdminUser(null);
      setIsImpersonating(false);
      localStorage.removeItem(IMPERSONATION_KEY);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signUp,
    signIn,
    signInAnonymously,
    signOut,
    updateProfile,
    clearError,
    isImpersonating,
    impersonatedUser,
    originalAdminUser,
    setImpersonatedUser,
    exitImpersonation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

