// Welcome email template — React Email
// TODO: Implement in F007

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
  passwordTicketUrl: string;
  expiryDays?: number;
}

export default function WelcomeEmail({
  name = "there",
  passwordTicketUrl = "https://example.com",
  expiryDays = 7,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5" }}>
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "40px",
            }}
          >
            <Text style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>
              Welcome to Compass
            </Text>
            <Text style={{ fontSize: "16px", color: "#374151", lineHeight: "1.6" }}>
              Hi {name},
            </Text>
            <Text style={{ fontSize: "16px", color: "#374151", lineHeight: "1.6" }}>
              Your Compass account is ready! Click the button below to set
              your password and get started.
            </Text>
            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button
                href={passwordTicketUrl}
                style={{
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  padding: "12px 32px",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: "600",
                  textDecoration: "none",
                }}
              >
                Set Your Password
              </Button>
            </Section>
            <Text style={{ fontSize: "14px", color: "#6b7280" }}>
              This link expires in {expiryDays} days. If it expires, contact
              your administrator.
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />
            <Text style={{ fontSize: "12px", color: "#9ca3af" }}>
              &mdash; The Compass Team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
