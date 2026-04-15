"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MemberTable } from "@/components/member-table";
import { MemberTableSkeleton } from "@/components/member-table-skeleton";
import type { MemberWithStatus } from "@/types";

export default function DashboardPage() {
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/circle/members");
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      const data: MemberWithStatus[] = await response.json();
      setMembers(data);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Existing Members
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        View and manage Circle.so community members and their Auth0 provisioning
        status.
      </p>

      <div className="mt-6">
        {loading ? (
          <MemberTableSkeleton />
        ) : (
          <MemberTable members={members} onMemberUpdated={fetchMembers} />
        )}
      </div>
    </div>
  );
}
