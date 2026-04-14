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
});
