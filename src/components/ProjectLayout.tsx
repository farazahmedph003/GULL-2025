import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from './Layout';
import ProjectHeader from './ProjectHeader';
import { db } from '../services/database';

interface ProjectLayoutProps {
  children: React.ReactNode;
}

/**
 * ProjectLayout Component - Wrapper for all project pages
 * 
 * Provides consistent layout and navigation for:
 * - Dashboard
 * - Akra
 * - Ring
 * - Advanced Filter
 * - History
 * 
 * Includes sidebar navigation and project context
 */
const ProjectLayout: React.FC<ProjectLayoutProps> = ({ children }) => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const projectData = await db.getProject(id);
        setProject(projectData);
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Loading project...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      header={id && project ? <ProjectHeader projectName={project.name} /> : undefined}
    >
      <div className="transition-opacity duration-300 ease-in-out">
        {children}
      </div>
    </Layout>
  );
};

export default ProjectLayout;

