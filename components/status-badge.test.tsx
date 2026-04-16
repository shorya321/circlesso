/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders 'Not Provisioned' for not_provisioned status", () => {
    render(<StatusBadge status="not_provisioned" />);
    expect(screen.getByText("Not Provisioned")).toBeTruthy();
  });

  it("renders 'Email Pending' for auth0_created status", () => {
    render(<StatusBadge status="auth0_created" />);
    expect(screen.getByText("Email Pending")).toBeTruthy();
  });

  it("renders 'Email Sent' for email_sent status", () => {
    render(<StatusBadge status="email_sent" />);
    expect(screen.getByText("Email Sent")).toBeTruthy();
  });

  it("renders 'Password Changed' for password_changed status", () => {
    render(<StatusBadge status="password_changed" />);
    expect(screen.getByText("Password Changed")).toBeTruthy();
  });

  it("renders 'Failed' for failed status", () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeTruthy();
  });

  it("applies red classes for not_provisioned", () => {
    const { container } = render(<StatusBadge status="not_provisioned" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-red");
  });

  it("applies amber classes for auth0_created", () => {
    const { container } = render(<StatusBadge status="auth0_created" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-amber");
  });

  it("applies green classes for email_sent", () => {
    const { container } = render(<StatusBadge status="email_sent" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-green");
  });

  it("applies blue classes for password_changed", () => {
    const { container } = render(<StatusBadge status="password_changed" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-blue");
  });
});
