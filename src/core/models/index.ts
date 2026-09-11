export interface UserRecord {
  id: string;
  email: string;
  is_active: number;
  roles: string;
  created_at: number;
  updated_at: number;
}

export interface OAuthAccountRecord {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  created_at: number;
}

export interface MagicLinkTokenRecord {
  id: string;
  email: string;
  token_hash: string;
  expires_at: number;
  is_used: number;
  created_at: number;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  is_revoked: number;
  device_info: string | null;
  expires_at: number;
  created_at: number;
  last_used_at: number;
}

export interface DeviceCodeRecord {
  id: string;
  device_code: string;
  user_code: string;
  user_id: string | null;
  status: "PENDING" | "AUTHORIZED" | "CONSUMED" | "EXPIRED";
  expires_at: number;
  created_at: number;
}
