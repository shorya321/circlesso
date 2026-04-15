import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { checkAdminAccess } from "@/lib/admin-check";
import { Sidebar } from "@/components/dashboard/sidebar";

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
    <div className="flex min-h-screen bg-background">
      <Sidebar userName={userName} userEmail={userEmail} />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
