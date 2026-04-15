"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MemberWithStatus, ProvisionResult } from "@/types";

interface MigrateAllButtonProps {
  members: MemberWithStatus[];
  onComplete: () => void;
}

const DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MigrateAllButton({
  members,
  onComplete,
}: MigrateAllButtonProps) {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const unprovisioned = members.filter(
    (m) => m.auth0Status === "not_provisioned"
  );

  const handleMigrateAll = async () => {
    if (unprovisioned.length === 0) return;

    setMigrating(true);
    setProgress({ current: 0, total: unprovisioned.length });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < unprovisioned.length; i++) {
      const member = unprovisioned[i];
      setProgress({ current: i + 1, total: unprovisioned.length });

      try {
        const response = await fetch("/api/provision/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: member.circleMember.email,
            name: member.circleMember.name,
            circleMemberId: String(member.circleMember.id),
          }),
        });

        const result: ProvisionResult = await response.json();

        if (response.ok && result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      // Rate limit delay between requests
      if (i < unprovisioned.length - 1) {
        await delay(DELAY_MS);
      }
    }

    setMigrating(false);

    if (failed === 0) {
      toast.success(`${succeeded} member${succeeded !== 1 ? "s" : ""} migrated successfully`);
    } else {
      toast.warning(`${succeeded} migrated, ${failed} failed`);
    }

    onComplete();
  };

  return (
    <Button
      onClick={handleMigrateAll}
      disabled={migrating || unprovisioned.length === 0}
      className="cursor-pointer"
    >
      {migrating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Migrating {progress.current}/{progress.total}...
        </>
      ) : (
        <>
          <Users className="mr-2 h-4 w-4" />
          Migrate All Unprovisioned ({unprovisioned.length})
        </>
      )}
    </Button>
  );
}
