import React from 'react';
import ImpersonationBanner from './ImpersonationBanner';

interface LayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, header, footer }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background-lightSecondary dark:bg-gray-900">
      <ImpersonationBanner />
      {header && (
        <header className="bg-gray-800 shadow-sm border-b border-gray-700">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
            {header}
          </div>
        </header>
      )}
      
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
      
      {footer && (
        <footer className="bg-gray-800 border-t border-gray-700">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;

