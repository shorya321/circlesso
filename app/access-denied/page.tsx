import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Access Denied
        </h1>
        <p className="text-muted-foreground">
          This dashboard is restricted to superadmin users. Your account does
          not have the required role.
        </p>
        <p className="text-sm text-muted-foreground">
          Contact your administrator if you believe this is an error.
        </p>
        <div className="pt-2">
          <Link href="/auth/logout" className={buttonVariants({ variant: "default" })}>
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}
