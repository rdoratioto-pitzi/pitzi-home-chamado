-- Insert default ticket settings if they don't exist
-- These settings are required for the ticket management system

INSERT INTO settings (id, key, value, updated_at)
SELECT gen_random_uuid(), 'ticket_categories', '[]', NOW()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ticket_categories');

INSERT INTO settings (id, key, value, updated_at)
SELECT gen_random_uuid(), 'ticket_types', '[]', NOW()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ticket_types');

INSERT INTO settings (id, key, value, updated_at)
SELECT gen_random_uuid(), 'ticket_locations', '[]', NOW()
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ticket_locations');
