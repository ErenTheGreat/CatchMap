/*
# Add location_name to catches

Stores a human-readable spot or area label when logging a catch
(e.g. selected map spot name or searched location label).
*/

ALTER TABLE catches
  ADD COLUMN IF NOT EXISTS location_name text;
