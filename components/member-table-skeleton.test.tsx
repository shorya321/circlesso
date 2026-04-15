/** @jest-environment jsdom */

/**
 * Tests for MemberTableSkeleton — loading state for member table.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemberTableSkeleton } from "./member-table-skeleton";

describe("MemberTableSkeleton", () => {
  it("renders a table with skeleton rows", () => {
    render(<MemberTableSkeleton />);

    const table = screen.getByRole("table");
    expect(table).toBeTruthy();
  });

  it("renders 5 skeleton rows by default", () => {
    const { container } = render(<MemberTableSkeleton />);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(5);
  });

  it("renders custom number of rows", () => {
    const { container } = render(<MemberTableSkeleton rows={3} />);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
  });

  it("renders skeleton pulse elements", () => {
    const { container } = render(<MemberTableSkeleton />);

    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders table headers matching member table columns", () => {
    render(<MemberTableSkeleton />);

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Action")).toBeTruthy();
  });
});
