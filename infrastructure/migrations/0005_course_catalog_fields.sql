-- Catalog filter/display fields, synced from WordPress (see apps/api/src/modules/wordpress/sync.ts).
-- All nullable/defaulted so this is safe to apply before the API code that writes them ships.
ALTER TABLE courses ADD COLUMN category VARCHAR;
ALTER TABLE courses ADD COLUMN short_description TEXT;
ALTER TABLE courses ADD COLUMN instructor_name VARCHAR;
ALTER TABLE courses ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false;
