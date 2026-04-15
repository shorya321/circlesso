/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MigrateAllButton } from "./migrate-all-button";
import type { MemberWithStatus } from "@/types";

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

describe("MigrateAllButton", () => {
  it("renders with unprovisioned count", () => {
    const members = [
      makeMember(1, "a@test.com", "not_provisioned"),
      makeMember(2, "b@test.com", "not_provisioned"),
      makeMember(3, "c@test.com", "email_sent"),
    ];
    render(<MigrateAllButton members={members} onComplete={jest.fn()} />);

    expect(screen.getByText(/migrate all.*2/i)).toBeTruthy();
  });

  it("is disabled when no unprovisioned members", () => {
    const members = [makeMember(1, "a@test.com", "email_sent")];
    render(<MigrateAllButton members={members} onComplete={jest.fn()} />);

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows progress during migration", async () => {
    // Use a promise we can resolve manually to control timing
    let resolveFirst!: (value: unknown) => void;
    const firstPromise = new Promise((r) => { resolveFirst = r; });

    mockFetch.mockReturnValueOnce(firstPromise);

    const members = [
      makeMember(1, "a@test.com", "not_provisioned"),
      makeMember(2, "b@test.com", "not_provisioned"),
    ];
    render(<MigrateAllButton members={members} onComplete={jest.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    // Should show progress text
    await waitFor(() => {
      expect(screen.getByText(/migrating 1\/2/i)).toBeTruthy();
    });

    // Resolve the first migration
    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => ({ success: true, status: "email_sent", emailSent: true }),
      });
    });
  });

  it("disables button during migration", async () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const members = [makeMember(1, "a@test.com", "not_provisioned")];
    render(<MigrateAllButton members={members} onComplete={jest.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      const button = screen.getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });
});
