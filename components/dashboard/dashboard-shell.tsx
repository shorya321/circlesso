"use client";

import { useState } from "react";
import { Navbar } from "@/components/dashboard/navbar";
import { Sidebar } from "@/components/dashboard/sidebar";

interface DashboardShellProps {
  userName: string | null;
  userEmail: string | null;
  children: React.ReactNode;
}

export function DashboardShell({
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        userName={userName}
        userEmail={userEmail}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((prev) => !prev)}
      />
      <div className="flex flex-1">
        <Sidebar
          userName={userName}
          userEmail={userEmail}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
