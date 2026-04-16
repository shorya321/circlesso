"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, Menu, X } from "lucide-react";

interface NavbarProps {
  userName: string | null;
  userEmail: string | null;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function Navbar({
  userName,
  userEmail,
  mobileOpen,
  onToggleMobile,
}: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = userName ?? "Admin";
  const initial = displayName.charAt(0).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <nav className="border-b border-border bg-card">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: mobile hamburger + branding */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground md:hidden"
            onClick={onToggleMobile}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo_helpucompli.avif" alt="Helpucompli" className="h-12 w-12 object-contain" />
            <span className="text-base font-semibold text-foreground">
              Helpucompli Admin
            </span>
          </div>
        </div>

        {/* Right: user dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-80"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="User menu"
          >
            {initial}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card shadow-lg">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {displayName}
                </p>
                {userEmail && (
                  <p className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </p>
                )}
              </div>
              <div className="p-1">
                <a
                  href="/auth/logout"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
