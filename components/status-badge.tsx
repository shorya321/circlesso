import type { ProvisioningStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProvisioningStatus;
}

const statusConfig: Record<
  ProvisioningStatus,
  { label: string; className: string }
> = {
  not_provisioned: {
    label: "Not Provisioned",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  auth0_created: {
    label: "Email Pending",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  email_sent: {
    label: "Email Sent",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  password_changed: {
    label: "Password Changed",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  blocked: {
    label: "Blocked",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
