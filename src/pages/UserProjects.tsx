import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
// import ThemeToggle from '../components/ThemeToggle';
import ImpersonationBanner from '../components/ImpersonationBanner';
import { db } from '../services/database';
import { useAuth } from '../contexts/AuthContext';
import type { Project } from '../types';

const UserProjects: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate(); void navigate;
  const { isImpersonating, exitImpersonation } = useAuth(); void isImpersonating; void exitImpersonation;
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  console.log('🔍 UserProjects component loaded with uid:', uid);
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 Current pathname:', window.location.pathname);

  useEffect(() => {
    const loadProjects = async () => {
      if (!uid) {
        console.log('❌ No user ID provided');
        setLoading(false);
        return;
      }

      console.log('🔍 Loading projects for user ID:', uid);
      console.log('🔍 Impersonation state:', isImpersonating);
      try {
        const userProjects = await db.getUserProjects(uid);
        console.log('📊 Found projects:', userProjects);
        setProjects(userProjects);
      } catch (error) {
        console.error('❌ Error loading user projects:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [uid, isImpersonating]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-700 dark:text-gray-300">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <ImpersonationBanner />
      
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


