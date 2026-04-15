"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ProvisionResult } from "@/types";

interface RetryEmailButtonProps {
  email: string;
  name: string;
  auth0UserId: string;
  onRetried: () => void;
}

export function RetryEmailButton({
  email,
  name,
  auth0UserId,
  onRetried,
}: RetryEmailButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleRetry = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/provision/retry-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          auth0UserId,
        }),
      });

      const result: ProvisionResult = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error ?? "Retry failed");
        return;
      }

      toast.success(`Welcome email resent to ${name}`);
      onRetried();
    } catch {
      toast.error("Failed to retry email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={handleRetry}
      className="cursor-pointer"
    >
      {loading ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="mr-1 h-3 w-3" />
      )}
      Retry Email
    </Button>
  );
}
