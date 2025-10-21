import React, { useState } from 'react';
import type { Project, EntryType } from '../types';
import { generateId } from '../utils/helpers';

interface ProjectFormProps {
  onSubmit: (project: Project) => void;
  onCancel?: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTypes, setEntryTypes] = useState<EntryType[]>(['akra']);
  const [errors, setErrors] = useState<{ name?: string; entryTypes?: string }>({});

  const handleEntryTypeToggle = (type: EntryType) => {
    setEntryTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
    // Clear entry type error when user makes a selection
    if (errors.entryTypes) {
      setErrors((prev) => ({ ...prev, entryTypes: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: { name?: string; entryTypes?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (entryTypes.length === 0) {
      newErrors.entryTypes = 'Select at least one entry type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const newProject: Project = {
      id: generateId(),
      name: name.trim(),
      date,
      entryTypes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSubmit(newProject);
    
    // Reset form
    setName('');
    setDate(new Date().toISOString().split('T')[0]);
    setEntryTypes(['akra']);
    setErrors({});
  };

  return (
    <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 shadow-xl">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 via-blue-50/10 to-indigo-50/20 dark:from-purple-900/10 dark:via-blue-900/5 dark:to-indigo-900/10 rounded-2xl"></div>
      
      <form onSubmit={handleSubmit} className="relative z-10">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-xl shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Create New Project
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set up a new accounting project
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label
              htmlFor="project-name"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="project-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${errors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Enter project name"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className={`w-5 h-5 ${errors.name ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            {errors.name && (
              <p className="mt-2 text-sm text-red-500 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.name}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="project-date"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
            >
              Date
            </label>
            <div className="relative">
              <input
                type="date"
                id="project-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Entry Types */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Entry Types <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                entryTypes.includes('open') 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-blue-300 dark:hover:border-blue-500'
              }`}>
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={entryTypes.includes('open')}
                      onChange={() => handleEntryTypeToggle('open')}
                      className="sr-only"
                    />
                    <div 
                      onClick={() => handleEntryTypeToggle('open')}
                      className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                        entryTypes.includes('open')
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-500 shadow-lg shadow-blue-500/25'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      {entryTypes.includes('open') && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${entryTypes.includes('open') ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                      <span className="font-medium text-gray-900 dark:text-white">Open</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">1-digit: 0-9</p>
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                entryTypes.includes('akra') 
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                  : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500'
              }`}>
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={entryTypes.includes('akra')}
                      onChange={() => handleEntryTypeToggle('akra')}
                      className="sr-only"
                    />
                    <div 
                      onClick={() => handleEntryTypeToggle('akra')}
                      className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                        entryTypes.includes('akra')
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-500 shadow-lg shadow-emerald-500/25'
                          : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:shadow-md'
                      }`}
                    >
                      {entryTypes.includes('akra') && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${entryTypes.includes('akra') ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                      <span className="font-medium text-gray-900 dark:text-white">Akra</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">2-digit: 00-99</p>
                  </div>
                </div>
              </label>
              
              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                entryTypes.includes('ring') 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                  : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-purple-300 dark:hover:border-purple-500'
              }`}>
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={entryTypes.includes('ring')}
                      onChange={() => handleEntryTypeToggle('ring')}
                      className="sr-only"
                    />
                    <div 
                      onClick={() => handleEntryTypeToggle('ring')}
                      className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                        entryTypes.includes('ring')
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 border-purple-500 shadow-lg shadow-purple-500/25'
                          : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:shadow-md'
                      }`}
                    >
                      {entryTypes.includes('ring') && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${entryTypes.includes('ring') ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                      <span className="font-medium text-gray-900 dark:text-white">Ring</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">3-digit: 000-999</p>
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                entryTypes.includes('packet') 
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                  : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-orange-300 dark:hover:border-orange-500'
              }`}>
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={entryTypes.includes('packet')}
                      onChange={() => handleEntryTypeToggle('packet')}
                      className="sr-only"
                    />
                    <div 
                      onClick={() => handleEntryTypeToggle('packet')}
                      className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                        entryTypes.includes('packet')
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-500 shadow-lg shadow-orange-500/25'
                          : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:shadow-md'
                      }`}
                    >
                      {entryTypes.includes('packet') && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${entryTypes.includes('packet') ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                      <span className="font-medium text-gray-900 dark:text-white">Packet</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">4-digit: 0000-9999</p>
                  </div>
                </div>
              </label>
            </div>
            {errors.entryTypes && (
              <p className="mt-2 text-sm text-red-500 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.entryTypes}
              </p>
            )}
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-gray-700 mt-8">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-all duration-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          )}
          <button 
            type="submit"
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Project</span>
            </div>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectForm;

