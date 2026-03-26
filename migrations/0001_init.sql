CREATE TABLE IF NOT EXISTS bot_state (
  singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
  bot_id TEXT NOT NULL,
  bot_token_ciphertext TEXT NOT NULL,
  ilink_user_id_ciphertext TEXT NOT NULL,
  context_token_ciphertext TEXT,
  get_updates_buf_ciphertext TEXT,
  status TEXT NOT NULL CHECK (status IN ('logged_in', 'needs_activation', 'ready', 'needs_login', 'error')),
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_session (
  session_id TEXT PRIMARY KEY,
  qrcode_token TEXT NOT NULL,
  qrcode_img_content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('wait', 'scanned', 'confirmed', 'expired')),
  expires_at TEXT NOT NULL,
  bot_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_log (
  delivery_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  trace_id TEXT,
  dedupe_key TEXT,
  idempotency_key TEXT UNIQUE,
  text TEXT NOT NULL,
  meta_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'retrying', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  response_code INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_created_at ON delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_session_expires_at ON login_session(expires_at);
