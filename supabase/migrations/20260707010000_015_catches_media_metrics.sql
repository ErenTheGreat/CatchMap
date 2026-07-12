/*
# Add media + metrics to catches

Adds richer catch data so the app can store a photo, the fish length, and a
snapshot of the weather/tide conditions at the moment the catch was logged.

1. New columns on `catches`
- `photo_uri` (text) - local device file URI for the catch photo (image bytes
  are not uploaded in this round; only the reference is stored)
- `length` (text) - free-form length of the fish (e.g. "18 in")
- `conditions` (jsonb) - weather + tide snapshot captured at catch time

2. Security
- No policy changes. Existing anon/authenticated CRUD policies still apply.
*/

ALTER TABLE catches
  ADD COLUMN IF NOT EXISTS photo_uri text,
  ADD COLUMN IF NOT EXISTS length text,
  ADD COLUMN IF NOT EXISTS conditions jsonb;
