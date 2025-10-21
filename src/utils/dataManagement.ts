import * as XLSX from 'xlsx';
import { db } from '../services/database';

// Helper function to get current user ID
const getCurrentUserId = (): string => {
  const userString = localStorage.getItem('user') || localStorage.getItem('gull-auth-user');
  if (userString) {
    try {
      const user = JSON.parse(userString);
      return user.id || 'anonymous-user';
    } catch {
      return 'anonymous-user';
    }
  }
  return 'anonymous-user';
};

export interface ExportData {
  version: string;
  exportDate: string;
  projects: any[];
  settings: Record<string, any>;
  user: any;
}

export interface BackupData extends ExportData {
  backupType: 'full' | 'partial';
  backupName: string;
}

// Export all user projects to JSON format
export const exportAllProjects = async (): Promise<ExportData | null> => {
  try {
    const userId = getCurrentUserId();
    const projects = await db.getProjects(userId);
    
    // Get current user settings
    const settings = {
      theme: localStorage.getItem('gull-theme') || 'dark',
      soundEnabled: localStorage.getItem('gull_sound_enabled') === 'true',
      soundVolumes: localStorage.getItem('gull_sound_volumes'),
      fontSize: localStorage.getItem('gull-font-size') || 'medium',
      animationsEnabled: localStorage.getItem('gull-animations-enabled') !== 'false'
    };

    // Get user info from localStorage or context
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const exportData: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      projects: projects || [],
      settings,
      user
    };

    // Download as JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `projects-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return exportData;
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export projects');
  }
};

// Export projects to Excel format
export const exportToExcel = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const projects = await db.getProjects(userId);
    
    if (!projects || projects.length === 0) {
      throw new Error('No projects to export');
    }

    // Transform data for Excel
    const workbook = XLSX.utils.book_new();
    
    // Create projects sheet
    const projectsData = projects.map((project: any) => ({
      'Project Name': project.name,
      'Project ID': project.id,
      'Entry Types': project.entryTypes?.join(', ') || '',
      'Created Date': project.date || '',
      'Total Entries': project.totalEntries || 0
    }));
    
    const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
    XLSX.utils.book_append_sheet(workbook, projectsSheet, 'Projects');

    // Generate Excel file
    XLSX.writeFile(workbook, `projects-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Excel export failed:', error);
    throw new Error('Failed to export to Excel');
  }
};

// Import projects from file
export const importFromFile = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData: ExportData = JSON.parse(content);
        
        // Validate import data
        if (!importData.version || !importData.projects) {
          throw new Error('Invalid import file format');
        }

        // Import projects one by one
        let importedCount = 0;
        const userId = getCurrentUserId();
        for (const project of importData.projects) {
          try {
            // Remove id to create new project
            const { id, ...projectData } = project;
            await db.createProject(userId, projectData);
            importedCount++;
          } catch (projectError) {
            console.warn('Failed to import project:', project.name, projectError);
          }
        }

        // Import settings if available
        if (importData.settings) {
          Object.entries(importData.settings).forEach(([key, value]) => {
            if (key.startsWith('gull-') || key.startsWith('gull_')) {
              localStorage.setItem(key, String(value));
            }
          });
        }

        resolve();
      } catch (error) {
        console.error('Import failed:', error);
        reject(new Error('Failed to import file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Clear application cache
export const clearAppCache = (): void => {
  try {
    // Clear localStorage items except user session
    const keysToKeep = ['user', 'auth-token', 'last-login'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear IndexedDB if available
    if ('indexedDB' in window) {
      indexedDB.databases?.().then(databases => {
        databases.forEach(database => {
          if (database.name) {
            indexedDB.deleteDatabase(database.name);
          }
        });
      });
    }

    console.log('App cache cleared successfully');
  } catch (error) {
    console.error('Failed to clear cache:', error);
    throw new Error('Failed to clear cache');
  }
};

// Create full backup
export const createBackup = async (backupName?: string): Promise<BackupData> => {
  try {
    const exportData = await exportAllProjects();
    
    if (!exportData) {
      throw new Error('Failed to create backup data');
    }

    const backup: BackupData = {
      ...exportData,
      backupType: 'full',
      backupName: backupName || `backup-${new Date().toISOString().split('T')[0]}`
    };

    // Store backup in localStorage
    const backupKey = `backup-${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));

    // Also download as file
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${backup.backupName}.backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return backup;
  } catch (error) {
    console.error('Backup creation failed:', error);
    throw new Error('Failed to create backup');
  }
};

// Restore from backup file
export const restoreFromBackup = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backupData: BackupData = JSON.parse(content);
        
        // Validate backup format
        if (!backupData.version || !backupData.projects) {
          throw new Error('Invalid backup file format');
        }

        // Clear existing data first (with confirmation)
        if (confirm('This will replace all current data. Are you sure?')) {
          await clearAppCache();
          
          // Import projects
          await importFromFile(file);
          
          // Restore settings
          if (backupData.settings) {
            Object.entries(backupData.settings).forEach(([key, value]) => {
              localStorage.setItem(key, String(value));
            });
          }

          resolve();
        } else {
          reject(new Error('Restore cancelled by user'));
        }
      } catch (error) {
        console.error('Restore failed:', error);
        reject(new Error('Failed to restore backup'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read backup file'));
    reader.readAsText(file);
  });
};

// Delete all user data (with confirmation)
export const deleteAllUserData = async (): Promise<void> => {
  const confirmText = 'DELETE ALL DATA';
  const userInput = prompt(
    `⚠️ WARNING: This will permanently delete ALL your data!\n\nType "${confirmText}" to confirm:`
  );

  if (userInput !== confirmText) {
    throw new Error('Data deletion cancelled - confirmation text did not match');
  }

  try {
    // Delete all projects
    const userId = getCurrentUserId();
    const projects = await db.getProjects(userId);
    if (projects) {
      for (const project of projects) {
        try {
          await db.deleteProject(project.id);
        } catch (error) {
          console.warn('Failed to delete project:', project.id, error);
        }
      }
    }

    // Clear all localStorage (except user session)
    const keysToKeep = ['user'];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    console.log('All user data deleted successfully');
  } catch (error) {
    console.error('Failed to delete user data:', error);
    throw new Error('Failed to delete user data');
  }
};
