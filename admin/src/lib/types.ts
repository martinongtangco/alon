// Response shapes for the admin API list endpoints (backend/src/routes/admin/*).
// Columns and allowed values mirror backend/scripts/db-setup.sql.

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

export interface AppUser {
  id: string;
  display_name: string;
  current_mode: 'Networking' | 'Chill' | 'Dating' | 'Explorer';
  vibes: string[];
  plan: 'Free' | 'Pro';
  status: 'Active' | 'Flagged' | 'Suspended' | 'Banned';
  platform: 'iOS' | 'Android' | null;
  last_active_at: string;
  created_at: string;
  // Not returned by GET /users; the page renders a fallback.
  email?: string;
  internal_token?: string;
}

export interface Business {
  id: string;
  name: string;
  category: string;
  plan: 'Basic' | 'Pro' | 'Enterprise';
  status: 'Active' | 'Pending' | 'Suspended' | 'Cancelled';
  contact_name: string;
  contact_email: string;
  address_city: string | null;
  created_at: string;
  approved_at: string | null;
  suspended_at: string | null;
}

export type PromoStatus = 'Active' | 'Paused' | 'Flagged' | 'Expired' | 'Killed' | 'Pending Approval';

export interface Promo {
  id: string;
  headline: string;
  broadcast_radius: number;
  redemption_count: number;
  redemption_limit: number | null; // null = unlimited
  status: PromoStatus;
  created_at: string;
  business_name: string;
}

export type EventStatus = 'Scheduled' | 'Live' | 'Ended' | 'Pending Review' | 'Rejected';

export interface AppEvent {
  id: string;
  name: string;
  event_date: string;
  status: EventStatus;
  is_featured: boolean;
  vibe_tags: string[];
  is_community: boolean;
  business_name: string | null; // LEFT JOIN
  submitter_name: string | null; // LEFT JOIN
}

export interface Flag {
  id: string;
  severity: 'High' | 'Medium' | 'Low';
  type: 'Profile Report' | 'Promo Fraud' | 'Buzz Spam' | 'Content' | 'Other';
  subject_id: string;
  subject_type: 'user' | 'business' | 'promo' | 'event';
  report_count: number;
  summary: string | null;
  auto_flagged: boolean;
  status: 'Open' | 'In Review' | 'Resolved';
  created_at: string;
}

export interface AuditEntry {
  id: string;
  admin_id: string;
  admin_role: string;
  action_type: string;
  subject_id: string | null;
  before_state: unknown;
  after_state: unknown;
  ip_address: string | null;
  created_at: string;
}
