/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { MemberActionsMenu } from "./member-actions-menu";
import type { MemberWithStatus, ProvisioningStatus } from "@/types";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeMember(status: ProvisioningStatus): MemberWithStatus {
  return {
    circleMember: {
      id: 1,
      email: "user@test.com",
      name: "Test User",
      first_name: "Test",
      last_name: "User",
      avatar_url: null,
      headline: null,
      created_at: "2026-01-01T00:00:00.000Z",
      last_seen_at: null,
      active: true,
      public_uid: "uid-1",
      user_id: 1,
      community_id: 12345,
      member_tags: [],
      posts_count: 0,
      comments_count: 0,
    },
    auth0Status: status,
    auth0UserId: status === "not_provisioned" ? null : "auth0|1",
    lastLogin: null,
    errorMessage: null,
  };
}

describe("MemberActionsMenu", () => {
  it("renders a three-dot trigger labeled with the member name", () => {
    render(
      <MemberActionsMenu
        member={makeMember("email_sent")}
        onMemberUpdated={jest.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /actions for test user/i })
    ).toBeTruthy();
  });

  it.each<ProvisioningStatus>([
    "not_provisioned",
    "auth0_created",
    "email_sent",
    "password_changed",
    "blocked",
    "failed",
  ])("renders trigger for %s status without errors", (status) => {
    render(
      <MemberActionsMenu
        member={makeMember(status)}
        onMemberUpdated={jest.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /actions for test user/i })
    ).toBeTruthy();
  });
});
