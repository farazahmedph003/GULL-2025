import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, header, footer }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background-lightSecondary dark:bg-gray-900">
      {header && (
        <header className="bg-gray-800 shadow-sm border-b border-gray-700">
          <div className="w-full px-6 sm:px-12 lg:px-20 xl:px-24 py-4 sm:py-5 lg:py-6">
            {header}
          </div>
        </header>
      )}
      
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-[100vw] sm:max-w-[720px] md:max-w-[960px] lg:max-w-[1120px] xl:max-w-[1400px]">
        {children}
      </main>
      
      {footer && (
        <footer className="bg-gray-800 border-t border-gray-700">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 max-w-[100vw] sm:max-w-[720px] md:max-w-[960px] lg:max-w-[1120px] xl:max-w-[1400px]">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;

