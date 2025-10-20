import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import ThemeToggle from '../components/ThemeToggle';
import { db } from '../services/database';
import type { Project } from '../types';

const UserProjects: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const userProjects = await db.getUserProjects(uid);
        setProjects(userProjects);
      } catch (error) {
        console.error('Error loading user projects:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-700 dark:text-gray-300">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-xl font-bold text-gradient-primary">User Projects</div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <button onClick={() => navigate('/admin')} className="btn-secondary text-sm">Back to Admin</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {projects.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">No projects for this user.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProjects;


