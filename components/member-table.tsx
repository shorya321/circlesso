"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
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

const PAGE_SIZE = 10;

interface MemberTableProps {
  members: MemberWithStatus[];
  onMemberUpdated: () => void;
}

export function MemberTable({ members, onMemberUpdated }: MemberTableProps) {
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [members.length]);

  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, members.length);
  const visibleMembers = members.slice(startIndex, endIndex);
  const showPagination = members.length > PAGE_SIZE;

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

  const renderAction = (member: MemberWithStatus, isLoading: boolean) => {
    switch (member.auth0Status) {
      case "not_provisioned":
        return (
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
        );
      case "auth0_created":
        return member.auth0UserId ? (
          <RetryEmailButton
            email={member.circleMember.email}
            name={member.circleMember.name}
            auth0UserId={member.auth0UserId}
            onRetried={onMemberUpdated}
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      case "email_sent":
      case "password_changed":
        return member.auth0UserId ? (
          <RetryEmailButton
            email={member.circleMember.email}
            name={member.circleMember.name}
            auth0UserId={member.auth0UserId}
            onRetried={onMemberUpdated}
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      case "failed":
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={onMemberUpdated}
            className="cursor-pointer"
            title={member.errorMessage ?? "Auth0 check failed — click to retry"}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry Check
          </Button>
        );
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
    <div>
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
        {visibleMembers.map((member) => {
          const isLoading = loadingIds.has(member.circleMember.id);

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
                {renderAction(member, isLoading)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
      {showPagination && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1}–{endIndex} of {members.length} members
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer"
            >
              <ChevronLeft className="mr-1 h-3 w-3" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              className="cursor-pointer"
            >
              Next
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
