"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { NewMemberForm } from "@/components/new-member-form";
import type { CircleAccessGroup } from "@/types";

export default function NewMemberPage() {
  const [accessGroups, setAccessGroups] = useState<CircleAccessGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccessGroups = useCallback(async () => {
    try {
      const response = await fetch("/api/circle/access-groups");
      if (!response.ok) {
        throw new Error("Failed to fetch access groups");
      }
      const data: CircleAccessGroup[] = await response.json();
      setAccessGroups(data);
    } catch {
      toast.error("Failed to load access groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessGroups();
  }, [fetchAccessGroups]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Add New Member
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a new member in Circle.so and Auth0, and send a welcome email.
      </p>

      <div className="mt-6 max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <NewMemberForm accessGroups={accessGroups} />
        )}
      </div>
    </div>
  );
}
