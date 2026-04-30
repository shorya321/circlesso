/** @jest-environment jsdom */

import { render, screen, fireEvent } from "@testing-library/react";
import { MemberTable } from "./member-table";
import type { MemberWithStatus } from "@/types";

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
  lastLogin: null,
  errorMessage: null,
});

describe("MemberTable", () => {
  it("renders member names and emails", () => {
    const members = [
      makeMember(1, "alice@test.com"),
      makeMember(2, "bob@test.com"),
    ];
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

  it("renders an actions menu trigger for every visible row regardless of status", () => {
    const members: MemberWithStatus[] = [
      makeMember(1, "a@test.com", "not_provisioned"),
      makeMember(2, "b@test.com", "auth0_created"),
      makeMember(3, "c@test.com", "email_sent"),
      makeMember(4, "d@test.com", "password_changed"),
      makeMember(5, "e@test.com", "blocked"),
      makeMember(6, "f@test.com", "failed"),
    ];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

    members.forEach((m) => {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`actions for ${m.circleMember.name}`, "i"),
        })
      ).toBeTruthy();
    });
  });

  it("renders gray Blocked badge for blocked members", () => {
    const members = [makeMember(1, "x@test.com", "blocked")];
    render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);
    expect(screen.getByText("Blocked")).toBeTruthy();
  });

  it("shows empty state when no members", () => {
    render(<MemberTable members={[]} onMemberUpdated={jest.fn()} />);
    expect(screen.getByText(/no members found/i)).toBeTruthy();
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

      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

      expect(screen.queryByText("user1@test.com")).toBeNull();
      expect(screen.getByText("user11@test.com")).toBeTruthy();
      expect(screen.getByText("user20@test.com")).toBeTruthy();
      expect(screen.getByText(/showing 11.*20.*of 25 members/i)).toBeTruthy();
    });

    it("disables Next on the last page", () => {
      const members = makeMembers(25);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      const next = screen.getByRole("button", { name: /^next$/i });
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

      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
      fireEvent.click(screen.getByRole("button", { name: /previous/i }));

      expect(screen.getByText("user1@test.com")).toBeTruthy();
      expect(screen.getByText("user10@test.com")).toBeTruthy();
    });

    it("does not render pagination footer when members fit on one page", () => {
      const members = makeMembers(5);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);

      expect(screen.queryByRole("button", { name: /^next$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /previous/i })).toBeNull();
      expect(screen.queryByText(/showing/i)).toBeNull();
    });

    it("does not render pagination footer when members count equals page size", () => {
      const members = makeMembers(10);
      render(<MemberTable members={members} onMemberUpdated={jest.fn()} />);
      expect(screen.queryByRole("button", { name: /^next$/i })).toBeNull();
    });

    it("resets to page 1 when members array length changes", () => {
      const members = makeMembers(25);
      const { rerender } = render(
        <MemberTable members={members} onMemberUpdated={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
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

      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
      expect(screen.getByText(/page 2 of 3/i)).toBeTruthy();
    });
  });
});
