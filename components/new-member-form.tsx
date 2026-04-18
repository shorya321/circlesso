"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CircleAccessGroup, ProvisionResult } from "@/types";

interface NewMemberFormProps {
  accessGroups: CircleAccessGroup[];
}

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  accessGroupIds: z
    .array(z.number().int().positive())
    .min(1, "Select at least one access group"),
});

type FormErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

export function NewMemberForm({ accessGroups }: NewMemberFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accessGroupIds, setAccessGroupIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setAccessGroupIds([]);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = formSchema.safeParse({
      firstName,
      lastName,
      email,
      accessGroupIds,
    });

    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/provision/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const result: ProvisionResult = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error ?? "Failed to create member");
        return;
      }

      if (result.accessGroupAssigned === false) {
        toast.warning(
          result.warning ??
            "Member created but NOT added to the access group. Assign manually in Circle dashboard."
        );
      } else if (!result.emailSent) {
        toast.warning(
          result.error ??
            "Member created but welcome email failed. Use Retry Email from the Existing Members tab."
        );
      } else if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success("Member created and welcome email sent");
      }

      resetForm();
    } catch {
      toast.error("Failed to create member");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add New Member
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="font-mono"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Access Groups</Label>
            <div
              role="group"
              aria-label="Access Groups"
              className="max-h-48 overflow-y-auto rounded-md border border-input p-3 space-y-2"
            >
              {accessGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No access groups available.
                </p>
              ) : (
                accessGroups.map((group) => {
                  const checked = accessGroupIds.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAccessGroupIds((prev) =>
                            prev.includes(group.id)
                              ? prev.filter((id) => id !== group.id)
                              : [...prev, group.id]
                          )
                        }
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                      <span>{group.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            {errors.accessGroupIds && (
              <p className="text-sm text-destructive">
                {errors.accessGroupIds}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Member"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
