import { Users, UserCheck, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MemberWithStatus } from "@/types";
import type { LucideIcon } from "lucide-react";

interface StatsCardsProps {
  members: MemberWithStatus[];
  loading: boolean;
}

interface StatCardConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  compute: (members: MemberWithStatus[]) => number;
}

const cardConfigs: readonly StatCardConfig[] = [
  {
    title: "Total Members",
    subtitle: "All circle members",
    icon: Users,
    compute: (members) => members.length,
  },
  {
    title: "Provisioned",
    subtitle: "Migration complete",
    icon: UserCheck,
    compute: (members) =>
      members.filter(
        (m) =>
          m.auth0Status === "email_sent" || m.auth0Status === "password_changed"
      ).length,
  },
  {
    title: "Pending",
    subtitle: "Awaiting migration",
    icon: Clock,
    compute: (members) =>
      members.filter(
        (m) =>
          m.auth0Status === "not_provisioned" ||
          m.auth0Status === "auth0_created"
      ).length,
  },
  {
    title: "Failed",
    subtitle: "Needs attention",
    icon: AlertTriangle,
    compute: (members) =>
      members.filter((m) => m.auth0Status === "failed").length,
  },
] as const;

function StatsCardSkeleton() {
  return (
    <Card size="sm" className="min-h-[7rem]">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export function StatsCards({ members, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {cardConfigs.map((config) => {
        const Icon = config.icon;
        const count = config.compute(members);

        return (
          <Card key={config.title} size="sm" className="min-h-[7rem]">
            <CardContent className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{config.title}</span>
              </div>
              <p className="text-3xl font-bold font-mono text-foreground">
                {count}
              </p>
              <p className="text-xs text-muted-foreground">
                {config.subtitle}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
