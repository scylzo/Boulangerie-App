import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('cm.sidebarCollapsed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('cm.sidebarCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-sand-950/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        mobileOpen={mobileOpen}
        collapsed={collapsed}
        onClose={() => setMobileOpen(false)}
      />

      {/* Contenu — marge adaptée à l'état du rail */}
      <div className={`${collapsed ? 'lg:ml-16' : 'lg:ml-64'} flex flex-col min-h-screen transition-[margin] duration-300`}>
        <Header
          onMenuClick={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          collapsed={collapsed}
        />
        <main className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
