/*
# Create fishing_spots table

1. New Tables
- `fishing_spots`
- `id` (uuid, primary key)
- `name` (text, not null) - Name of the fishing location
- `description` (text) - Description of the spot
- `latitude` (decimal, not null) - Geographic latitude
- `longitude` (decimal, not null) - Geographic longitude  
- `water_type` (text) - Type: lake, river, pond, bay, coastal
- `species` (text array) - Array of fish species IDs found here
- `facilities` (text array) - Available facilities (boat_launch, pier, parking, restrooms)
- `best_months` (integer array) - Best months to fish (1-12)
- `rating` (decimal) - Average rating 0-5
- `created_at` (timestamp)

2. Security
- Enable RLS on `fishing_spots`.
- Allow anon + authenticated read (public fishing spot data).
- Allow anon + authenticated insert (users can add spots).
- Allow anon + authenticated update/delete.

3. Notes
- This is single-tenant (no auth), so policies use `TO anon, authenticated`.
- Spots contain species IDs that reference the species.json data.
- Geograhic coordinates enable proximity searches.
*/

CREATE TABLE IF NOT EXISTS fishing_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  latitude decimal(10, 7) NOT NULL,
  longitude decimal(10, 7) NOT NULL,
  water_type text NOT NULL DEFAULT 'lake',
  species text[] DEFAULT '{}',
  facilities text[] DEFAULT '{}',
  best_months integer[] DEFAULT '{}',
  rating decimal(2,1) DEFAULT 4.0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fishing_spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_spots" ON fishing_spots;
CREATE POLICY "anon_select_spots" ON fishing_spots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_spots" ON fishing_spots;
CREATE POLICY "anon_insert_spots" ON fishing_spots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_spots" ON fishing_spots;
CREATE POLICY "anon_update_spots" ON fishing_spots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_spots" ON fishing_spots;
CREATE POLICY "anon_delete_spots" ON fishing_spots FOR DELETE
  TO anon, authenticated USING (true);

-- Create an index on location for proximity queries
CREATE INDEX IF NOT EXISTS idx_fishing_spots_location ON fishing_spots (latitude, longitude);

-- Seed initial fishing spots data
INSERT INTO fishing_spots (name, description, latitude, longitude, water_type, species, facilities, best_months, rating) VALUES
-- Northwest (Portland/Seattle area)
('Columbia River', 'Major river system known for salmon, steelhead, and walleye. Multiple public access points along the river.', 45.65, -122.6, 'river', ARRAY['3','4','13','14','15','3','8'], ARRAY['boat_launch','parking','pier'], ARRAY[4,5,6,9,10], 4.7),
('Spirit Lake', 'Clear mountain lake with excellent trout fishing. Surrounded by forest with hiking trails.', 46.92, -122.18, 'lake', ARRAY['2','9','19','6'], ARRAY['parking','pier'], ARRAY[5,6,7,8,9], 4.5),
('Puget Sound South', 'Saltwater fishing for salmon, cod, and rockfish. Multiple beach access points.', 47.25, -122.55, 'coastal', ARRAY['14','15','11'], ARRAY['parking','boat_launch'], ARRAY[6,7,8,9,10], 4.6),

-- Southeast (Florida/Gulf)
('Lake Okeechobee', 'Legendary bass fishing destination. Largest freshwater lake in Florida with abundant wildlife.', 26.95, -80.95, 'lake', ARRAY['1','18','6','5'], ARRAY['boat_launch','parking','restrooms'], ARRAY[1,2,3,4,11,12], 4.8),
('Tampa Bay', 'Inshore fishing paradise for redfish, snook, and tarpon. Pier and flats fishing available.', 27.75, -82.63, 'bay', ARRAY['16','17'], ARRAY['pier','parking','boat_launch'], ARRAY[3,4,5,10,11], 4.7),
('St. Johns River', 'Historic river with excellent bass fishing and diverse ecosystems. Good for beginners.', 29.72, -81.55, 'river', ARRAY['1','18','5','7','6'], ARRAY['boat_launch','parking'], ARRAY[3,4,5,10,11], 4.4),

-- Midwest (Great Lakes region)
('Lake Michigan - Chicago', 'Shore and boat fishing for salmon, trout, and perch. Multiple harbors and piers.', 41.88, -87.63, 'lake', ARRAY['14','15','9','13','19'], ARRAY['pier','parking','boat_launch'], ARRAY[4,5,6,9,10], 4.5),
('Lake of the Woods', 'Premier walleye and muskie destination. Remote wilderness experience with guides available.', 49.0, -94.8, 'lake', ARRAY['3','10','4','9','19'], ARRAY['boat_launch','parking','restrooms'], ARRAY[5,6,7,8,9,10], 4.9),
('Mississippi River - Pool 4', 'Backwaters excellent for panfish, bass, and walleye. Scenic bluff views.', 44.37, -92.31, 'river', ARRAY['3','7','6','1'], ARRAY['boat_launch','parking'], ARRAY[5,6,7,8,9], 4.3),

-- Northeast
('Lake Champlain', 'Large freshwater lake with landlocked salmon, lake trout, and bass. Beautiful scenery.', 44.47, -73.25, 'lake', ARRAY['2','19','1','8','9'], ARRAY['boat_launch','pier','parking','restrooms'], ARRAY[4,5,6,9,10], 4.6),
('Cape Cod Bay', 'Striped bass capital with surfcasting opportunities. Charter boats also available.', 41.83, -70.1, 'bay', ARRAY['11','16','17'], ARRAY['boat_launch','parking','pier'], ARRAY[5,6,7,8,9,10], 4.8),
('Niagara River', 'World-class steelhead and salmon fishing. Strong currents require safety awareness.', 43.08, -79.07, 'river', ARRAY['13','14','15','9'], ARRAY['parking','pier'], ARRAY[9,10,11,3,4,5], 4.7),

-- Southwest
('Lake Powell', 'Stunning red rock canyon lake with striped bass and largemouth. Houseboat rentals available.', 37.02, -111.03, 'lake', ARRAY['1','11','5','6'], ARRAY['boat_launch','parking','restrooms'], ARRAY[4,5,6,9,10], 4.6),
('Lake Mead', 'Large reservoir near Las Vegas with striped bass and catfish. Multiple marinas.', 36.15, -114.38, 'lake', ARRAY['11','1','5'], ARRAY['boat_launch','parking','restrooms'], ARRAY[4,5,6,7,8,9,10], 4.4),
('Trinity River', 'Known for alligator gar and catfish. Remote Texas fishing experience.', 30.5, -94.95, 'river', ARRAY['5','20','1'], ARRAY['parking','boat_launch'], ARRAY[5,6,7,8,9], 4.2),

-- West (California)
('Clear Lake', 'Oldest lake in North America. Famous for trophy largemouth bass fishing.', 39.0, -122.88, 'lake', ARRAY['1','6','7','1'], ARRAY['boat_launch','parking','restrooms'], ARRAY[3,4,5,10,11], 4.7),
('San Francisco Bay', 'Striped bass, halibut, and sturgeon. Multiple piers and boat launches around the bay.', 37.78, -122.38, 'bay', ARRAY['11','9'], ARRAY['pier','parking','boat_launch'], ARRAY[5,6,7,8,9,10], 4.4),
('Sacramento River Delta', 'Extensive river system with striped bass, sturgeon, and catfish. Scenic waterways.', 38.25, -121.55, 'river', ARRAY['11','5','1'], ARRAY['boat_launch','parking'], ARRAY[4,5,6,7,8,9,10], 4.5),

-- South (Texas/Louisiana)
('Toledo Bend Reservoir', 'Bass fishing mecca on Texas-Louisiana border. Numerous tournaments held here.', 31.5, -93.55, 'lake', ARRAY['1','5','6','7'], ARRAY['boat_launch','parking','restrooms'], ARRAY[3,4,5,10,11], 4.8),
('Galveston Bay', 'Premier Texas saltwater fishing for redfish, trout, and flounder.', 29.55, -94.87, 'bay', ARRAY['16','17'], ARRAY['boat_launch','pier','parking'], ARRAY[4,5,6,9,10,11], 4.6),
('Caddo Lake', 'Mysterious swampland with cypress trees. Unique fishing for crappie and bass.', 32.72, -93.97, 'lake', ARRAY['7','1','6','5'], ARRAY['boat_launch','parking'], ARRAY[3,4,5,10,11], 4.5);
