/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewMemberForm } from "./new-member-form";
import type { CircleAccessGroup } from "@/types";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

const mockGroups: CircleAccessGroup[] = [
  { id: 1, name: "Group A", description: null, community_id: 12345, created_at: "2026-01-01", updated_at: "2026-01-01" },
  { id: 2, name: "Group B", description: null, community_id: 12345, created_at: "2026-01-01", updated_at: "2026-01-01" },
];

describe("NewMemberForm", () => {
  it("renders all form fields", () => {
    render(<NewMemberForm accessGroups={mockGroups} />);

    expect(screen.getByLabelText(/first name/i)).toBeTruthy();
    expect(screen.getByLabelText(/last name/i)).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByRole("group", { name: /access groups/i })).toBeTruthy();
    expect(screen.getByLabelText(/group a/i)).toBeTruthy();
    expect(screen.getByLabelText(/group b/i)).toBeTruthy();
  });

  it("renders submit button", () => {
    render(<NewMemberForm accessGroups={mockGroups} />);

    expect(screen.getByRole("button", { name: /create member/i })).toBeTruthy();
  });

  it("shows validation errors for empty required fields on submit", async () => {
    render(<NewMemberForm accessGroups={mockGroups} />);

    fireEvent.click(screen.getByRole("button", { name: /create member/i }));

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeTruthy();
    });
  });

  it("does not call API when form is submitted with empty fields", async () => {
    render(<NewMemberForm accessGroups={mockGroups} />);

    fireEvent.click(screen.getByRole("button", { name: /create member/i }));

    // API should not be called when validation fails
    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("calls create API on valid submission with selected access group ids", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: "email_sent", emailSent: true }),
    });

    render(<NewMemberForm accessGroups={mockGroups} />);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "john@test.com" } });
    fireEvent.click(screen.getByLabelText(/group a/i));
    fireEvent.click(screen.getByLabelText(/group b/i));

    fireEvent.click(screen.getByRole("button", { name: /create member/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/provision/create", expect.objectContaining({
        method: "POST",
      }));
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.accessGroupIds).toEqual([1, 2]);
  });

  it("shows validation error when no access group is selected", async () => {
    render(<NewMemberForm accessGroups={mockGroups} />);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "john@test.com" } });

    fireEvent.click(screen.getByRole("button", { name: /create member/i }));

    await waitFor(() => {
      expect(screen.getByText(/select at least one access group/i)).toBeTruthy();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("toggles access group selection off when clicked twice", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: "email_sent", emailSent: true }),
    });

    render(<NewMemberForm accessGroups={mockGroups} />);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "john@test.com" } });
    fireEvent.click(screen.getByLabelText(/group a/i));
    fireEvent.click(screen.getByLabelText(/group b/i));
    fireEvent.click(screen.getByLabelText(/group a/i));

    fireEvent.click(screen.getByRole("button", { name: /create member/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.accessGroupIds).toEqual([2]);
  });
});
