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

  it("renders Retry Email button for auth0_created members", () => {
    const members = [makeMember(1, "a@test.com", "auth0_created")];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

    expect(screen.getByRole("button", { name: /retry email/i })).toBeTruthy();
  });

  it("shows empty state when no members", () => {
    render(<MemberTable members={[]} onMemberUpdated={jest.fn()} />);

    expect(screen.getByText(/no members found/i)).toBeTruthy();
  });

  describe("action cell per status", () => {
    it("renders em-dash placeholder for email_sent members", () => {
      const members = [makeMember(1, "done@test.com", "email_sent")];
      const { container } = render(
        <MemberTable members={members} onMemberUpdated={jest.fn()} />
      );

      const actionCell = container.querySelectorAll("tbody td")[3];
      expect(actionCell?.textContent).toContain("—");
      expect(
        screen.queryByRole("button", { name: /migrate/i })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: /retry email/i })
      ).toBeNull();
    });

    it("does not render Migrate button for email_sent members", () => {
      const members = [makeMember(1, "a@test.com", "email_sent")];
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.queryByRole("button", { name: /migrate/i })).toBeNull();
    });

    it("renders Retry Check button for failed members", () => {
      const members = [makeMember(1, "oops@test.com", "failed")];
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(
        screen.getByRole("button", { name: /retry check/i })
      ).toBeTruthy();
    });

    it("does not render Migrate button for failed members", () => {
      const members = [makeMember(1, "oops@test.com", "failed")];
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.queryByRole("button", { name: /migrate/i })).toBeNull();
    });

    it("Retry Check button calls onMemberUpdated on click", () => {
      const onMemberUpdated = jest.fn();
      const members = [makeMember(1, "oops@test.com", "failed")];
      render(
        <MemberTable members={members} onMemberUpdated={onMemberUpdated} />
      );

      fireEvent.click(screen.getByRole("button", { name: /retry check/i }));
      expect(onMemberUpdated).toHaveBeenCalledTimes(1);
    });

    it("renders an action affordance for every visible row across pages", () => {
      const members: MemberWithStatus[] = Array.from(
        { length: 25 },
        (_, i) => makeMember(i + 1, `user${i + 1}@test.com`, "email_sent")
      );
      const { container } = render(
        <MemberTable members={members} onMemberUpdated={jest.fn()} />
      );

      const assertAllActionCellsHaveContent = () => {
        const rows = container.querySelectorAll("tbody tr");
        rows.forEach((row) => {
          const actionCell = row.querySelectorAll("td")[3];
          expect(actionCell?.textContent?.trim().length).toBeGreaterThan(0);
        });
      };

      assertAllActionCellsHaveContent();

      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      assertAllActionCellsHaveContent();

      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      assertAllActionCellsHaveContent();
    });
  });

  describe("pagination", () => {
    const makeMembers = (count: number): MemberWithStatus[] =>
      Array.from({ length: count }, (_, i) =>
        makeMember(i + 1, `user${i + 1}@test.com`)
      );

    it("renders only the first 10 members on initial render when there are 25", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.getByText("user1@test.com")).toBeTruthy();
      expect(screen.getByText("user10@test.com")).toBeTruthy();
      expect(screen.queryByText("user11@test.com")).toBeNull();
      expect(screen.queryByText("user25@test.com")).toBeNull();
    });

    it("renders pagination summary text", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.getByText(/showing 1.*10.*of 25 members/i)).toBeTruthy();
    });

    it("advances to page 2 on Next click", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.queryByText("user1@test.com")).toBeNull();
      expect(screen.getByText("user11@test.com")).toBeTruthy();
      expect(screen.getByText("user20@test.com")).toBeTruthy();
      expect(screen.getByText(/showing 11.*20.*of 25 members/i)).toBeTruthy();
    });

    it("disables Next on the last page", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      const next = screen.getByRole("button", { name: /next/i });
      fireEvent.click(next);
      fireEvent.click(next);

      expect(screen.getByText("user21@test.com")).toBeTruthy();
      expect(screen.getByText("user25@test.com")).toBeTruthy();
      expect((next as HTMLButtonElement).disabled).toBe(true);
    });

    it("disables Previous on page 1", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      const prev = screen.getByRole("button", { name: /previous/i });
      expect((prev as HTMLButtonElement).disabled).toBe(true);
    });

    it("goes back to page 1 on Previous click", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      fireEvent.click(screen.getByRole("button", { name: /previous/i }));

      expect(screen.getByText("user1@test.com")).toBeTruthy();
      expect(screen.getByText("user10@test.com")).toBeTruthy();
    });

    it("does not render pagination footer when members fit on one page", () => {
      const members = makeMembers(5);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /previous/i })).toBeNull();
      expect(screen.queryByText(/showing/i)).toBeNull();
    });

    it("does not render pagination footer when members count equals page size", () => {
      const members = makeMembers(10);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
    });

    it("resets to page 1 when members array length changes", () => {
      const members = makeMembers(25);
      const { rerender } = render(
        <MemberTable members={members} onMemberUpdated={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("user11@test.com")).toBeTruthy();

      rerender(
        <MemberTable members={makeMembers(30)} onMemberUpdated={jest.fn()} />
      );

      expect(screen.getByText("user1@test.com")).toBeTruthy();
      expect(screen.getByText("user10@test.com")).toBeTruthy();
      expect(screen.queryByText("user11@test.com")).toBeNull();
    });

    it("displays current page number and total pages", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.getByText(/page 1 of 3/i)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText(/page 2 of 3/i)).toBeTruthy();
    });
  });
});
