/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RetryEmailButton } from "./retry-email-button";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RetryEmailButton", () => {
  it("renders Retry Email button", () => {
    render(
      <RetryEmailButton
        email="test@example.com"
        name="Test User"
        auth0UserId="auth0|123"
        onRetried={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /retry email/i })).toBeTruthy();
  });

  it("calls provision/retry-email API on click with auth0UserId body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: "email_sent", emailSent: true }),
    });

    const onRetried = jest.fn();
    render(
      <RetryEmailButton
        email="test@example.com"
        name="Test User"
        auth0UserId="auth0|123"
        onRetried={onRetried}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /retry email/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/provision/retry-email",
        expect.objectContaining({ method: "POST" })
      );
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      email: "test@example.com",
      name: "Test User",
      auth0UserId: "auth0|123",
    });

    await waitFor(() => {
      expect(onRetried).toHaveBeenCalled();
    });
  });

  it("shows loading state while retrying", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <RetryEmailButton
        email="test@example.com"
        name="Test User"
        auth0UserId="auth0|123"
        onRetried={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /retry email/i }));

    await waitFor(() => {
      const button = screen.getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });
});
