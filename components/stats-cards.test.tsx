/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { StatsCards } from "./stats-cards";
import type { MemberWithStatus } from "@/types";

function makeMember(
  auth0Status: MemberWithStatus["auth0Status"]
): MemberWithStatus {
  return {
    circleMember: {
      id: Math.floor(Math.random() * 10000),
      email: "test@example.com",
      name: "Test User",
      first_name: "Test",
      last_name: "User",
      avatar_url: null,
      headline: null,
      created_at: "2026-01-01T00:00:00Z",
      last_seen_at: null,
      active: true,
      public_uid: "uid-123",
      user_id: 1,
      community_id: 1,
      member_tags: [],
      posts_count: 0,
      comments_count: 0,
    },
    auth0Status,
    auth0UserId: auth0Status === "not_provisioned" ? null : "auth0|123",
    errorMessage: auth0Status === "failed" ? "Lookup failed" : null,
  };
}

describe("StatsCards", () => {
  it("renders 4 cards with correct computed counts", () => {
    const members: MemberWithStatus[] = [
      makeMember("not_provisioned"),
      makeMember("not_provisioned"),
      makeMember("auth0_created"),
      makeMember("email_sent"),
      makeMember("email_sent"),
      makeMember("email_sent"),
      makeMember("password_changed"),
      makeMember("failed"),
    ];

    render(<StatsCards members={members} loading={false} />);

    expect(screen.getByText("Total Members")).toBeTruthy();
    expect(screen.getByText("Provisioned")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();

    // Total: 8
    expect(screen.getByText("8")).toBeTruthy();
    // Provisioned: email_sent(3) + password_changed(1) = 4
    expect(screen.getByText("4")).toBeTruthy();
    // Pending: not_provisioned(2) + auth0_created(1) = 3
    expect(screen.getByText("3")).toBeTruthy();
    // Failed: 1
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders skeleton state when loading", () => {
    const { container } = render(
      <StatsCards members={[]} loading={true} />
    );

    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);

    // Should not render card titles when loading
    expect(screen.queryByText("Total Members")).toBeNull();
  });

  it("handles empty members array with all zeros", () => {
    render(<StatsCards members={[]} loading={false} />);

    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(4);
  });

  it("handles all members with same status", () => {
    const members: MemberWithStatus[] = [
      makeMember("email_sent"),
      makeMember("email_sent"),
      makeMember("email_sent"),
    ];

    render(<StatsCards members={members} loading={false} />);

    // Total: 3, Provisioned: 3 (both show "3")
    expect(screen.getAllByText("3")).toHaveLength(2);
    // Pending: 0, Failed: 0
    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("renders subtitle descriptions", () => {
    render(<StatsCards members={[]} loading={false} />);

    expect(screen.getByText("All circle members")).toBeTruthy();
    expect(screen.getByText("Migration complete")).toBeTruthy();
    expect(screen.getByText("Awaiting migration")).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
  });
});
