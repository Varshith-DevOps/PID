'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';

/** Standard authenticated app frame: deep-ink sidebar + content canvas.
 *  Pages render their PageHeader + content as children. */
export function AppShell({ children, activePath }: { children: React.ReactNode; activePath?: string }) {
  return (
    <div className="app-layout">
      <Sidebar activePath={activePath} />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default AppShell;
