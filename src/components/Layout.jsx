import React from 'react';
import Sidebar from '@/components/Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;