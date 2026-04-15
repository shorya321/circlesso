"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { RetryEmailButton } from "@/components/retry-email-button";
import type { MemberWithStatus, ProvisionResult } from "@/types";

interface MemberTableProps {
  members: MemberWithStatus[];
  onMemberUpdated: () => void;
}

export function MemberTable({ members, onMemberUpdated }: MemberTableProps) {
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  const handleMigrate = async (member: MemberWithStatus) => {
    const memberId = member.circleMember.id;

    setLoadingIds((prev) => new Set([...prev, memberId]));

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

      if (!response.ok || !result.success) {
        toast.error(result.error ?? "Migration failed");
        return;
      }

      if (result.emailSent) {
        toast.success(`${member.circleMember.name} migrated successfully`);
      } else {
        toast.warning(
          `${member.circleMember.name} created in Auth0 but email failed. Use Retry Email.`
        );
      }

      onMemberUpdated();
    } catch {
      toast.error(`Failed to migrate ${member.circleMember.name}`);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  if (members.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No members found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const isLoading = loadingIds.has(member.circleMember.id);
          const showMigrate = member.auth0Status === "not_provisioned";
          const showRetry = member.auth0Status === "auth0_created";

          return (
            <TableRow key={member.circleMember.id}>
              <TableCell className="font-medium">
                {member.circleMember.name}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {member.circleMember.email}
              </TableCell>
              <TableCell>
                <StatusBadge status={member.auth0Status} />
              </TableCell>
              <TableCell className="text-right">
                {showMigrate && (
                  <Button
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleMigrate(member)}
                    className="cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-1 h-3 w-3" />
                    )}
                    Migrate
                  </Button>
                )}
                {showRetry && member.auth0UserId && (
                  <RetryEmailButton
                    email={member.circleMember.email}
                    name={member.circleMember.name}
                    auth0UserId={member.auth0UserId}
                    onRetried={onMemberUpdated}
                  />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
