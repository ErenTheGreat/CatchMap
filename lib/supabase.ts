import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface FishingSpot {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  water_type: string;
  species: string[];
  facilities: string[];
  best_months: number[];
  rating: number;
  created_at: string;
}
