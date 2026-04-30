import { generateRandomPassword } from "./utils";

describe("generateRandomPassword", () => {
  it("generates a password of 32 characters by default", () => {
    const password = generateRandomPassword();
    expect(password).toHaveLength(32);
  });

  it("generates a password of custom length", () => {
    const password = generateRandomPassword(48);
    expect(password).toHaveLength(48);
  });

  it("contains at least one uppercase letter", () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[A-Z]/);
  });

  it("contains at least one lowercase letter", () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[a-z]/);
  });

  it("contains at least one digit", () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[0-9]/);
  });

  it("contains at least one special character", () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{};':"|,.<>/?]/);
  });

  it("generates unique passwords on each call", () => {
    const passwords = new Set(
      Array.from({ length: 10 }, () => generateRandomPassword())
    );
    expect(passwords.size).toBe(10);
  });

  it("only contains valid characters", () => {
    const password = generateRandomPassword();
    const validChars =
      /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"|,.<>/?]+$/;
    expect(password).toMatch(validChars);
  });

  it("produces approximately uniform character distribution (no modulo bias)", () => {
    // Generate enough output to make biased selection statistically obvious.
    // 1000 passwords × 32 chars = 32_000 samples; expected per-char ≈ 351
    // for a 91-char alphabet. Allow ±50% to accommodate normal variance.
    const counts = new Map<string, number>();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      for (const ch of generateRandomPassword()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    const totalChars = iterations * 32;
    const alphabetSize = 91;
    const expected = totalChars / alphabetSize;
    const lowerBound = expected * 0.5;
    const upperBound = expected * 1.5;
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(lowerBound);
      expect(count).toBeLessThan(upperBound);
    }
  });
});
