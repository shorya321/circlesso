"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  provisionBlock,
  provisionMigrate,
  provisionRetryEmail,
  provisionUnblock,
} from "@/lib/provision-actions";
import type { MemberWithStatus, ProvisionResult } from "@/types";

interface MemberActionsMenuProps {
  member: MemberWithStatus;
  onMemberUpdated: () => void;
}

type ConfirmAction = "block" | "unblock" | null;

export function MemberActionsMenu({
  member,
  onMemberUpdated,
}: MemberActionsMenuProps) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const status = member.auth0Status;
  const auth0UserId = member.auth0UserId;
  const memberName = member.circleMember.name;

  const canMigrate = status === "not_provisioned";
  const canRetryEmail =
    Boolean(auth0UserId) &&
    (status === "auth0_created" ||
      status === "email_sent" ||
      status === "password_changed");
  const canBlock =
    Boolean(auth0UserId) &&
    (status === "auth0_created" ||
      status === "email_sent" ||
      status === "password_changed");
  const canUnblock = Boolean(auth0UserId) && status === "blocked";
  const canRetryCheck = status === "failed";

  async function runAction(
    label: string,
    action: () => Promise<ProvisionResult>,
    successMessage: string
  ): Promise<void> {
    setLoading(true);
    try {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? `${label} failed`);
        return;
      }
      toast.success(successMessage);
      onMemberUpdated();
    } catch {
      toast.error(`${label} failed`);
    } finally {
      setLoading(false);
    }
  }

  const handleMigrate = (): Promise<void> =>
    runAction(
      "Migrate",
      () =>
        provisionMigrate({
          email: member.circleMember.email,
          name: memberName,
          circleMemberId: String(member.circleMember.id),
        }),
      `${memberName} migrated successfully`
    );

  const handleRetryEmail = (): Promise<void> => {
    if (!auth0UserId) {
      toast.error("Missing user ID");
      return Promise.resolve();
    }
    return runAction(
      "Password reset",
      () =>
        provisionRetryEmail({
          email: member.circleMember.email,
          name: memberName,
          auth0UserId,
        }),
      `Password reset email sent to ${memberName}`
    );
  };

  const handleBlock = (): Promise<void> => {
    if (!auth0UserId) {
      toast.error("Missing user ID");
      return Promise.resolve();
    }
    return runAction(
      "Block",
      () => provisionBlock({ auth0UserId }),
      `${memberName} blocked`
    );
  };

  const handleUnblock = (): Promise<void> => {
    if (!auth0UserId) {
      toast.error("Missing user ID");
      return Promise.resolve();
    }
    return runAction(
      "Unblock",
      () => provisionUnblock({ auth0UserId }),
      `${memberName} unblocked`
    );
  };

  const confirmCopy =
    confirm === "block"
      ? {
          title: `Block ${memberName}?`,
          description:
            "They will be unable to log in via Auth0 until you unblock them.",
          actionLabel: "Block",
          handler: handleBlock,
        }
      : confirm === "unblock"
        ? {
            title: `Unblock ${memberName}?`,
            description:
              "They will be able to log in again immediately.",
            actionLabel: "Unblock",
            handler: handleUnblock,
          }
        : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              aria-label={`Actions for ${memberName}`}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem
            disabled={!canMigrate || loading}
            onClick={() => {
              if (canMigrate) void handleMigrate();
            }}
          >
            Migrate
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canRetryEmail || loading}
            onClick={() => {
              if (canRetryEmail) void handleRetryEmail();
            }}
          >
            Password Reset
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canBlock || loading}
            variant="destructive"
            onClick={() => {
              if (canBlock) setConfirm("block");
            }}
          >
            Block
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canUnblock || loading}
            onClick={() => {
              if (canUnblock) setConfirm("unblock");
            }}
          >
            Unblock
          </DropdownMenuItem>
          {canRetryCheck && (
            <DropdownMenuItem onClick={() => onMemberUpdated()}>
              Retry Check
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        {confirmCopy && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmCopy.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={loading}
                variant={confirm === "block" ? "destructive" : "default"}
                onClick={async () => {
                  const fn = confirmCopy.handler;
                  setConfirm(null);
                  await fn();
                }}
              >
                {confirmCopy.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
