import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNeroAuth } from '../../contexts/NeroAuthContext';
import { db } from '../../../services/database';
import type { Project } from '../../../types';

// Function to bridge Nero impersonation to main app
const bridgeToMainApp = async (supabaseUserId: string) => {
  try {
    // Set impersonation state in main app's localStorage
    const impersonationData = {
      impersonatedUserId: supabaseUserId,
      originalAdmin: null // Will be set by main app
    };
    localStorage.setItem('gull-admin-impersonation', JSON.stringify(impersonationData));
    
    // Navigate to main app
    window.location.href = '/';
  } catch (error) {
    console.error('Failed to bridge to main app:', error);
  }
};

const AdminImpersonatedProjects: React.FC = () => {
  const { userId } = useParams<{ userId: string }>(); void userId;
  const navigate = useNavigate();
  const { user, originalUser, exitImpersonation, impersonatedSupabaseUserId } = useNeroAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      if (!impersonatedSupabaseUserId) {
        setLoading(false);
        setError('No Supabase user ID available for impersonation');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const userProjects = await db.getUserProjects(impersonatedSupabaseUserId);
        setProjects(userProjects);
      } catch (err) {
        console.error('Error loading impersonated user projects:', err);
        setError('Failed to load user projects');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [impersonatedSupabaseUserId]);

  const handleViewInMainApp = (projectId: string) => {
    if (impersonatedSupabaseUserId) {
      bridgeToMainApp(impersonatedSupabaseUserId);
    } else {
      // Fallback: navigate directly to project
      window.location.href = `/project/${projectId}`;
    }
  };

  const handleExitImpersonation = () => {
    exitImpersonation();
    navigate('/nero/admin/users');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading user projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Impersonation Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Impersonating User</h2>
              <p className="text-purple-100">
                Viewing as: <span className="font-semibold">{user?.displayName}</span> ({user?.email})
              </p>
            </div>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit Impersonation
          </button>
          {impersonatedSupabaseUserId && (
            <button
              onClick={() => bridgeToMainApp(impersonatedSupabaseUserId)}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Go to Main App
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {user?.displayName}'s Projects
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage projects for this user
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Admin: {originalUser?.displayName}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="nero-card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Projects Found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This user doesn't have any projects yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="nero-card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
              {'No description'}
                  </p>
                </div>
                <span className={`nero-badge ${
                  'nero-badge-secondary'
                }`}>
                  {'inactive'}
                </span>
              </div>

              {/* Project Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total First</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    PKR {0}      
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Second</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    PKR {0}     
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Entries</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {0}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Numbers</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {0}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewInMainApp(project.id)}
                  className="flex-1 nero-btn-primary flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in Main App
                </button>
              </div>

              {/* Project Info */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                  <span>Updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {projects.length > 0 && (
        <div className="nero-card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total First</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                PKR {0}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Second</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                PKR {0}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminImpersonatedProjects;
