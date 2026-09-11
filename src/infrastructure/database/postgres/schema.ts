export const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  roles TEXT NOT NULL DEFAULT '["user"]',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT uq_oauth_provider_uid UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at BIGINT NOT NULL,
  is_used SMALLINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  family_id VARCHAR(255) NOT NULL,
  is_revoked SMALLINT NOT NULL DEFAULT 0,
  device_info TEXT,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_codes (
  id VARCHAR(255) PRIMARY KEY,
  device_code VARCHAR(255) UNIQUE NOT NULL,
  user_code VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pg_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_pg_magic_link_hash ON magic_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pg_refresh_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pg_refresh_token_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_pg_device_codes_user_code ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_pg_device_codes_device_code ON device_codes(device_code);
`;
