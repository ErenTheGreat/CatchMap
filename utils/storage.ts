import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const CATCHES_KEY = '@fishing_catches';

export interface CatchRecord {
  id: string;
  species: string;
  speciesId: string;
  weight: string;
  lure: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  date: string;
  createdAt: number;
}

// Database-backed storage
export const saveCatch = async (catchData: Omit<CatchRecord, 'id' | 'createdAt'>): Promise<CatchRecord> => {
  try {
    const newCatch = {
      species: catchData.species,
      species_id: catchData.speciesId,
      weight: catchData.weight,
      lure: catchData.lure || null,
      notes: catchData.notes || null,
      latitude: catchData.latitude,
      longitude: catchData.longitude,
      caught_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('catches')
      .insert([newCatch])
      .select()
      .single();

    if (error) {
      console.error('Supabase error, falling back to local:', error);
      return await saveCatchLocal(catchData);
    }

    return {
      id: data.id,
      species: data.species,
      speciesId: data.species_id || '',
      weight: data.weight,
      lure: data.lure || '',
      notes: data.notes || '',
      latitude: data.latitude,
      longitude: data.longitude,
      date: new Date(data.caught_at).toLocaleDateString(),
      createdAt: new Date(data.caught_at).getTime(),
    };
  } catch (error) {
    console.error('Error saving catch, falling back to local:', error);
    return await saveCatchLocal(catchData);
  }
};

const saveCatchLocal = async (catchData: Omit<CatchRecord, 'id' | 'createdAt'>): Promise<CatchRecord> => {
  const newCatch: CatchRecord = {
    ...catchData,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: Date.now(),
  };

  const existingCatches = await getCatchesLocal();
  const updatedCatches = [newCatch, ...existingCatches];
  await AsyncStorage.setItem(CATCHES_KEY, JSON.stringify(updatedCatches));
  return newCatch;
};

export const getCatches = async (): Promise<CatchRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('catches')
      .select('*')
      .order('caught_at', { ascending: false });

    if (error) {
      console.error('Supabase error, falling back to local:', error);
      return await getCatchesLocal();
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      species: item.species,
      speciesId: item.species_id || '',
      weight: item.weight,
      lure: item.lure || '',
      notes: item.notes || '',
      latitude: item.latitude,
      longitude: item.longitude,
      date: new Date(item.caught_at).toLocaleDateString(),
      createdAt: new Date(item.caught_at).getTime(),
    }));
  } catch (error) {
    console.error('Error getting catches, falling back to local:', error);
    return await getCatchesLocal();
  }
};

const getCatchesLocal = async (): Promise<CatchRecord[]> => {
  try {
    const catches = await AsyncStorage.getItem(CATCHES_KEY);
    return catches ? JSON.parse(catches) : [];
  } catch (error) {
    console.error('Error getting local catches:', error);
    return [];
  }
};

export const deleteCatch = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('catches')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
    }
  } catch (error) {
    console.error('Error deleting catch:', error);
  }

  // Also delete from local
  try {
    const existingCatches = await getCatchesLocal();
    const updatedCatches = existingCatches.filter(c => c.id !== id);
    await AsyncStorage.setItem(CATCHES_KEY, JSON.stringify(updatedCatches));
  } catch (error) {
    console.error('Error deleting local catch:', error);
  }
};

export const clearAllCatches = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CATCHES_KEY);
  } catch (error) {
    console.error('Error clearing catches:', error);
  }
};
