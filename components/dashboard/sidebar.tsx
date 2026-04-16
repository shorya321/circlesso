"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserPlus, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userName: string | null;
  userEmail: string | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Existing Members", icon: Users },
  { href: "/dashboard/new-member", label: "Add New Member", icon: UserPlus },
];

export function Sidebar({
  userName,
  userEmail,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const displayName = userName ?? "Admin";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card pt-14 transition-transform duration-200 md:static md:translate-x-0 md:pt-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <nav className="flex-1 space-y-1 px-3 py-4" role="navigation">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-border px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{displayName}</p>
                {userEmail && (
                  <p className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
            <a
              href="/auth/logout"
              className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
