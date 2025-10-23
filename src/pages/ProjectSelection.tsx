import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';
import Layout from '../components/Layout';
import ProjectCard from '../components/ProjectCard';
import ProjectForm from '../components/ProjectForm';
import LoadingSpinner from '../components/LoadingSpinner';
import ProfileDropdown from '../components/ProfileDropdown';
import type { Project } from '../types';
import { db } from '../services/database';
import { isSupabaseConfigured, isOfflineMode } from '../lib/supabase';

const ProjectSelection: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user ? isAdminEmail(user.email) : false;

  // No longer automatically redirect admins - they can use projects too

  useEffect(() => {
    // Load projects from Supabase database
    const loadProjects = async () => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setError(null);
      try {
        const dbProjects = await db.getUserProjects(user.id);
        setProjects(dbProjects);
        console.log('Projects loaded from database:', dbProjects.length);
      } catch (error) {
        console.error('Error loading projects from database:', error);
        setProjects([]);
        let errorMessage = 'Failed to load projects.';
        if (isOfflineMode()) {
          errorMessage = 'Database is in offline mode. Please check your connection settings.';
        } else if (!isSupabaseConfigured()) {
          errorMessage = 'Database is not properly configured. Please check your environment settings.';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user]);

  const handleCreateProject = async (project: Project) => {
    // Ensure user is logged in before creating a project
    if (!user || !user.id) {
      console.error('Cannot create project: User is not logged in');
      alert('Error: You must be logged in to create a project. Please sign in and try again.');
      return;
    }

    try {
      // Create project in Supabase database
      const dbProject = await db.createProject(user.id, {
        name: project.name,
        entryTypes: project.entryTypes,
        date: project.date,
      });

      // Update local state with the created project
      setProjects((prev) => [...prev, dbProject]);
      console.log('Project created in database successfully:', dbProject.name);
      
    } catch (error) {
      console.error('Error creating project:', error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to create project. ';
      
      if (error instanceof Error) {
        if (error.message.includes('Database not available')) {
          errorMessage += 'Database connection issue. Please check your internet connection and try again.';
        } else if (error.message.includes('entry_types') || error.message.includes('constraint')) {
          errorMessage += 'The selected entry types (Open, Packet) are not supported yet by the database. Please select only Akra and/or Ring for now, or contact support for assistance.';
        } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
          errorMessage += 'A project with this name already exists. Please choose a different name.';
        } else {
          errorMessage += `Error: ${error.message}`;
        }
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }
      
      alert(errorMessage);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      // Delete from Supabase database
      await db.deleteProject(projectId);
      
      // Update local state
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      console.log('Project deleted from database successfully');
      
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please check your internet connection and try again.');
    }
  };

  const header = (
    <div className="py-4 flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-white">
          GULL
        </h1>
        <p className="text-sm text-gray-300 mt-1">
          Accounting Management System
        </p>
      </div>
      <div className="flex items-center space-x-3">
        {/* Admin Panel Button */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Admin Panel</span>
            <span className="text-xs opacity-75">👑</span>
          </button>
        )}

        {user && <ProfileDropdown />}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Layout header={header}>
        <LoadingSpinner text="Loading projects..." />
      </Layout>
    );
  }

  return (
    <Layout header={header}>
      <div className="max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to GULL
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage your accounting projects with precision and ease
          </p>
        </div>

        {/* Project Form */}
        <div className="mb-8">
          <ProjectForm onSubmit={handleCreateProject} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load projects</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length > 0 ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Your Projects
              </h3>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  statistics={{
                    totalEntries: 0,
                    akraEntries: 0,
                    ringEntries: 0,
                    firstTotal: 0,
                    secondTotal: 0,
                    uniqueNumbers: 0,
                  }}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
              No projects yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Create your first project to get started
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectSelection;
