// ============= Auth =============
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: Role[];
  assigned_form_count?: number;
  assigned_as_submitter?: number;
  assigned_as_reviewer?: number;
  assigned_forms?: AssignedForm[];
}

export interface AssignedForm {
  id: number;
  form_code: string;
  name: string;
  is_active: boolean;
  role?: string;  
  assigned_at?: string;
}

export interface AssignedUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Permission {
  id: number;
  code: string;
  description: string;
  resource: string;
  action: string;
}

// ============= Forms =============
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'datetime' | 'rating';

export interface FormFieldDefinition {
  id: number;
  form_id: number;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  is_required: boolean;
  validation_rules: Record<string, unknown>;
  display_order: number;
  options: string[] | null;
  default_value: string | number | boolean | null;
}

export interface RequestNumbering {
  id: number;
  form_id: number;
  prefix: string;
  year_reset: boolean;
  current_sequence: number;
  current_year: number;
}

export interface Form {
  id: number;
  form_code: string;
  name: string;
  description: string;
  print_scale: number;
  is_active: boolean;
  requires_approval: boolean;
  approval_levels: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  fields: FormFieldDefinition[];
  numbering: RequestNumbering | null;
  submission_count?: number;
  submitters_count?: number;
  reviewers_count?: number;
}

// ============= Submissions =============
export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_correction';

export type CommentType = 'general' | 'review' | 'correction_request';

export type WorkflowActionType = 'submit' | 'approve' | 'reject' | 'request_changes' | 'resubmit';

export interface Submission {
  id: number;
  request_number: string;
  form_id: number;
  user_id: number;
  status: SubmissionStatus;
  version_number: number;
  current_assignee: { id: number; full_name: string } | number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  form?: Form;
  user?: User;
  /** Flat fields returned by list endpoints */
  form_name?: string;
  form_code?: string;
  submitted_by?: string;
  submitter_name?: string;
  current_version?: SubmissionVersion;
  versions?: SubmissionVersion[];
  comments?: SubmissionComment[];
  workflow_actions?: WorkflowAction[];
}

export interface SubmissionVersion {
  id: number;
  submission_id: number;
  version_number: number;
  data: Record<string, unknown>;
  created_by: number;
  created_at: string;
  is_approved_snapshot: boolean;
}

export interface SubmissionComment {
  id: number;
  submission_id: number;
  user_id: number;
  comment: string;
  comment_type: CommentType;
  created_at: string;
  user?: User;
}

export interface WorkflowAction {
  id: number;
  submission_id: number;
  user_id: number;
  action: WorkflowActionType;
  comment: string | null;
  from_status: SubmissionStatus;
  to_status: SubmissionStatus;
  created_at: string;
  user?: User;
}

// ============= Audit =============
export interface AuditLog {
  id: number;
  event_id: string;
  timestamp: string;
  user_id: number | null;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string;
}

// ============= API =============
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    page_size: number;
    total: number;
    pages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    detail: Record<string, unknown>;
  };
}

// ============= Reports =============
export interface AdminDashboardStats {
  active_users: number;
  total_forms: number;
  total_submissions: number;
  submissions_by_status: Record<string, number>;
  submissions_by_form: Array<{ form_name: string; count: number }>;
  submissions_by_month: Array<{ month: string; count: number }>;
  approval_rate_pct: number;
  avg_review_time_hours: number;
}

export interface ReviewerDashboardStats {
  pending_reviews: number;
  reviewed_today: number;
  reviewed_this_week: number;
  avg_review_time_hours: number;
  rejection_rate_pct: number;
}

export interface UserDashboardStats {
  my_submissions_total: number;
  drafts: number;
  submitted: number;
  approved: number;
  rejected: number;
  needs_correction: number;
  recent_activity: WorkflowAction[];
}
