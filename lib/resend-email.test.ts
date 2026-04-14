import { sendWelcomeEmail } from "./resend-email";

// Mock config
jest.mock("./config", () => ({
  getConfig: () => ({
    RESEND_API_KEY: "re_test_123456",
    EMAIL_FROM: "noreply@helpucompli.com",
  }),
}));

// Mock Resend SDK
const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

beforeEach(() => {
  mockSend.mockReset();
});

describe("sendWelcomeEmail", () => {
  it("sends a welcome email via Resend with correct params", async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: "email-id-123" },
      error: null,
    });

    const result = await sendWelcomeEmail(
      "user@example.com",
      "John Doe",
      "https://auth0.com/lo/reset?ticket=abc"
    );

    expect(result).toEqual({ id: "email-id-123" });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@helpucompli.com",
        to: "user@example.com",
        subject: "Set up your HelpUcompli account",
      })
    );
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid API key" },
    });

    await expect(
      sendWelcomeEmail(
        "user@example.com",
        "John",
        "https://example.com/reset"
      )
    ).rejects.toThrow("Failed to send welcome email: Invalid API key");
  });

  it("passes the react email component", async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: "email-id-456" },
      error: null,
    });

    await sendWelcomeEmail(
      "test@example.com",
      "Jane",
      "https://example.com/ticket"
    );

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.react).toBeDefined();
  });
});
