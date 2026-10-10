-- Record the request data seen for blocked browsers:
--   last_ip / last_user_agent: most recent blocked hit (updates on every beacon)
--   ips: JSON array with every distinct IP detected for the fingerprint
--        (seeded from stored visits and extended by blocked hits)

ALTER TABLE blocked_fingerprints ADD COLUMN last_ip TEXT;
ALTER TABLE blocked_fingerprints ADD COLUMN last_user_agent TEXT;
ALTER TABLE blocked_fingerprints ADD COLUMN ips TEXT NOT NULL DEFAULT '[]';
