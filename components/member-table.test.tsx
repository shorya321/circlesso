/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemberTable } from "./member-table";
import type { MemberWithStatus } from "@/types";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

const makeMember = (
  id: number,
  email: string,
  status: MemberWithStatus["auth0Status"] = "not_provisioned"
): MemberWithStatus => ({
  circleMember: {
    id,
    email,
    name: `User ${id}`,
    first_name: "User",
    last_name: `${id}`,
    avatar_url: null,
    headline: null,
    created_at: "2026-01-01T00:00:00.000Z",
    last_seen_at: null,
    active: true,
    public_uid: `uid-${id}`,
    user_id: id,
    community_id: 12345,
    member_tags: [],
    posts_count: 0,
    comments_count: 0,
  },
  auth0Status: status,
  auth0UserId: status !== "not_provisioned" ? `auth0|${id}` : null,
  errorMessage: null,
});

describe("MemberTable", () => {
  it("renders member names and emails", () => {
    const members = [makeMember(1, "alice@test.com"), makeMember(2, "bob@test.com")];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

    expect(screen.getByText("User 1")).toBeTruthy();
    expect(screen.getByText("alice@test.com")).toBeTruthy();
    expect(screen.getByText("User 2")).toBeTruthy();
    expect(screen.getByText("bob@test.com")).toBeTruthy();
  });

  it("renders status badges for each member", () => {
    const members = [
      makeMember(1, "a@test.com", "not_provisioned"),
      makeMember(2, "b@test.com", "email_sent"),
    ];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

    expect(screen.getByText("Not Provisioned")).toBeTruthy();
    expect(screen.getByText("Email Sent")).toBeTruthy();
  });

  it("renders Migrate button for not_provisioned members", () => {
    const members = [makeMember(1, "a@test.com", "not_provisioned")];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

    expect(screen.getByRole("button", { name: /migrate/i })).toBeTruthy();
  });

  it("does not render action button for email_sent members", () => {
    const members = [makeMember(1, "a@test.com", "email_sent")];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

    expect(screen.queryByRole("button", { name: /migrate/i })).toBeNull();
  });

  it("calls migrate API on Migrate button click", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: "email_sent", auth0UserId: "auth0|1", emailSent: true }),
    });

    const onMemberUpdated = jest.fn();
    const members = [makeMember(1, "a@test.com", "not_provisioned")];
    render(<MemberTable members={members} onMemberUpdated={onMemberUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: /migrate/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/provision/migrate", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  it("shows empty state when no members", () => {
    render(<MemberTable members={[]} onMemberUpdated={jest.fn()} />);

    expect(screen.getByText(/no members found/i)).toBeTruthy();
  });
});
