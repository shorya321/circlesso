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
  const defaultProps = {
    userName: "Admin",
    userEmail: "admin@test.com",
    mobileOpen: false,
    onCloseMobile: jest.fn(),
  };

  it("renders both navigation items", () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText("Existing Members")).toBeTruthy();
    expect(screen.getByText("Add New Member")).toBeTruthy();
  });

  it("displays admin user name", () => {
    render(
      <Sidebar
        userName="Jane Doe"
        userEmail="jane@test.com"
        mobileOpen={false}
        onCloseMobile={jest.fn()}
      />
    );

    expect(screen.getByText("Jane Doe")).toBeTruthy();
  });

  it("renders logout link pointing to /auth/logout", () => {
    render(<Sidebar {...defaultProps} />);

    const logoutLink = screen.getByRole("link", { name: /log\s*out/i });
    expect(logoutLink.getAttribute("href")).toBe("/auth/logout");
  });

  it("shows fallback when userName is null", () => {
    render(
      <Sidebar
        userName={null}
        userEmail={null}
        mobileOpen={false}
        onCloseMobile={jest.fn()}
      />
    );

    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("highlights Existing Members when on /dashboard", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar {...defaultProps} />);

    const membersLink = screen.getByText("Existing Members").closest("a");
    expect(membersLink?.className).toContain("bg-primary");
  });

  it("highlights Add New Member when on /dashboard/new-member", () => {
    mockPathname.mockReturnValue("/dashboard/new-member");
    render(<Sidebar {...defaultProps} />);

    const newMemberLink = screen.getByText("Add New Member").closest("a");
    expect(newMemberLink?.className).toContain("bg-primary");
  });

  it("calls onCloseMobile when a nav link is clicked", () => {
    const onCloseMobile = jest.fn();
    render(
      <Sidebar
        userName="Admin"
        userEmail="admin@test.com"
        mobileOpen={true}
        onCloseMobile={onCloseMobile}
      />
    );

    screen.getByText("Existing Members").click();
    expect(onCloseMobile).toHaveBeenCalledTimes(1);
  });

  it("renders mobile backdrop when mobileOpen is true", () => {
    const { container } = render(
      <Sidebar
        userName="Admin"
        userEmail="admin@test.com"
        mobileOpen={true}
        onCloseMobile={jest.fn()}
      />
    );

    const backdrop = container.querySelector("div[aria-hidden='true']");
    expect(backdrop).toBeTruthy();
  });

  it("does not render mobile backdrop when mobileOpen is false", () => {
    const { container } = render(<Sidebar {...defaultProps} />);

    const backdrop = container.querySelector("div[aria-hidden='true']");
    expect(backdrop).toBeFalsy();
  });
});
