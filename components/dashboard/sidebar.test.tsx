/** @jest-environment jsdom */

/**
 * Tests for Sidebar component — nav items, user display, logout link.
 */

const mockPathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
});

describe("Sidebar", () => {
  it("renders both navigation items", () => {
    render(<Sidebar userName="Admin" userEmail="admin@test.com" />);

    expect(screen.getByText("Existing Members")).toBeTruthy();
    expect(screen.getByText("Add New Member")).toBeTruthy();
  });

  it("displays admin user name", () => {
    render(<Sidebar userName="Jane Doe" userEmail="jane@test.com" />);

    expect(screen.getByText("Jane Doe")).toBeTruthy();
  });

  it("renders logout link pointing to /auth/logout", () => {
    render(<Sidebar userName="Admin" userEmail="admin@test.com" />);

    const logoutLink = screen.getByRole("link", { name: /log\s*out/i });
    expect(logoutLink.getAttribute("href")).toBe("/auth/logout");
  });

  it("highlights Existing Members when on /dashboard", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar userName="Admin" userEmail="admin@test.com" />);

    const membersLink = screen.getByText("Existing Members").closest("a");
    expect(membersLink?.className).toContain("bg-primary");
  });

  it("highlights Add New Member when on /dashboard/new-member", () => {
    mockPathname.mockReturnValue("/dashboard/new-member");
    render(<Sidebar userName="Admin" userEmail="admin@test.com" />);

    const newMemberLink = screen.getByText("Add New Member").closest("a");
    expect(newMemberLink?.className).toContain("bg-primary");
  });

  it("shows fallback when userName is null", () => {
    render(<Sidebar userName={null} userEmail={null} />);

    expect(screen.getByText("Admin")).toBeTruthy();
  });
});
