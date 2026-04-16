import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { checkAdminAccess } from "@/lib/admin-check";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await checkAdminAccess();

  if (!access.isAuthenticated) {
    redirect("/auth/login");
  }

  if (!access.isAdmin) {
    redirect("/access-denied");
  }

  const session = await auth0.getSession();
  const userName = (session?.user.name as string) ?? null;
  const userEmail = (session?.user.email as string) ?? null;

  return (
    <DashboardShell userName={userName} userEmail={userEmail}>
      {children}
    </DashboardShell>
  );
}
