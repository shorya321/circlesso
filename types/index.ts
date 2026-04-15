// Circle.so Admin API v2 types

export interface CircleMember {
  id: number;
  email: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  created_at: string;
  last_seen_at: string | null;
  active: boolean;
  public_uid: string;
  user_id: number;
  community_id: number;
  member_tags: string[];
  posts_count: number;
  comments_count: number;
}

export interface CircleAccessGroup {
  id: number;
  name: string;
  description: string | null;
  community_id: number;
  created_at: string;
  updated_at: string;
}

export interface CirclePaginatedResponse<T> {
  page: number;
  per_page: number;
  has_next_page: boolean;
  count: number;
  records: T[];
}

// Auth0 Management API types

export interface Auth0User {
  user_id: string;
  email: string;
  name: string;
  email_verified: boolean;
  created_at: string;
  app_metadata: Auth0AppMetadata;
}

export interface Auth0AppMetadata {
  source?: "admin_provisioning";
  circle_member_id?: string;
  email_sent?: boolean;
  email_sent_at?: string;
}

export interface Auth0PasswordTicket {
  ticket: string;
}

export interface Auth0Role {
  id: string;
  name: string;
  description?: string;
}

// Provisioning types

export type ProvisioningStatus =
  | "not_provisioned"
  | "auth0_created"
  | "email_sent"
  | "failed";

export interface MemberWithStatus {
  circleMember: CircleMember;
  auth0Status: ProvisioningStatus;
  auth0UserId: string | null;
  errorMessage: string | null;
}

export interface MigratePayload {
  email: string;
  name: string;
  circleMemberId: string;
}

export interface CreateMemberPayload {
  firstName: string;
  lastName: string;
  email: string;
  accessGroupId: number;
}

export interface ProvisionResult {
  success: boolean;
  status: ProvisioningStatus;
  auth0UserId?: string;
  emailSent?: boolean;
  accessGroupAssigned?: boolean;
  warning?: string;
  error?: string;
}
