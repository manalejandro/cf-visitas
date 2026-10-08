-- Track the algorithm of each tracker key so the Worker can migrate from the
-- legacy RSA-OAEP keys to post-quantum ML-KEM (FIPS 203) keys and still decrypt
-- payloads produced by trackers served before the switch.

ALTER TABLE tracker_keys ADD COLUMN algorithm TEXT NOT NULL DEFAULT 'RSA-OAEP-256';

CREATE INDEX IF NOT EXISTS idx_tracker_keys_algorithm ON tracker_keys (algorithm);
