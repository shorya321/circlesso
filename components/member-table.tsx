"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { MemberActionsMenu } from "@/components/member-actions-menu";
import type { MemberWithStatus } from "@/types";

const PAGE_SIZE = 10;

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return `${diffMon} month${diffMon === 1 ? "" : "s"} ago`;
  const diffYr = Math.floor(diffMon / 12);
  return `${diffYr} year${diffYr === 1 ? "" : "s"} ago`;
}

interface MemberTableProps {
  members: MemberWithStatus[];
  onMemberUpdated: () => void;
}

export function MemberTable({ members, onMemberUpdated }: MemberTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [trackedLength, setTrackedLength] = useState(members.length);

  if (trackedLength !== members.length) {
    setTrackedLength(members.length);
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, members.length);
  const visibleMembers = members.slice(startIndex, endIndex);
  const showPagination = members.length > PAGE_SIZE;

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
            <TableHead>Last Login</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleMembers.map((member) => (
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
              <TableCell className="text-sm text-muted-foreground">
                {formatLastLogin(member.lastLogin)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <MemberActionsMenu
                    member={member}
                    onMemberUpdated={onMemberUpdated}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
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
