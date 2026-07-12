import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TemperatureUnit = 'F' | 'C';
export type WeightUnit = 'lb' | 'kg';

const TEMP_KEY = '@units_temperature';
const WEIGHT_KEY = '@units_weight';

interface UnitsContextValue {
  temperatureUnit: TemperatureUnit;
  weightUnit: WeightUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  /** Formats a Fahrenheit value into the user's chosen unit, e.g. "68°F". */
  formatTemperature: (fahrenheit: number) => string;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [temperatureUnit, setTemperatureUnitState] = useState<TemperatureUnit>('F');
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('lb');

  useEffect(() => {
    AsyncStorage.multiGet([TEMP_KEY, WEIGHT_KEY])
      .then((entries) => {
        for (const [key, value] of entries) {
          if (key === TEMP_KEY && (value === 'F' || value === 'C')) {
            setTemperatureUnitState(value);
          }
          if (key === WEIGHT_KEY && (value === 'lb' || value === 'kg')) {
            setWeightUnitState(value);
          }
        }
      })
      .catch(() => {});
  }, []);

  const setTemperatureUnit = useCallback((unit: TemperatureUnit) => {
    setTemperatureUnitState(unit);
    AsyncStorage.setItem(TEMP_KEY, unit).catch(() => {});
  }, []);

  const setWeightUnit = useCallback((unit: WeightUnit) => {
    setWeightUnitState(unit);
    AsyncStorage.setItem(WEIGHT_KEY, unit).catch(() => {});
  }, []);

  const formatTemperature = useCallback(
    (fahrenheit: number) => {
      if (temperatureUnit === 'C') {
        return `${Math.round(((fahrenheit - 32) * 5) / 9)}°C`;
      }
      return `${Math.round(fahrenheit)}°F`;
    },
    [temperatureUnit]
  );

  const value = useMemo(
    () => ({
      temperatureUnit,
      weightUnit,
      setTemperatureUnit,
      setWeightUnit,
      formatTemperature,
    }),
    [temperatureUnit, weightUnit, setTemperatureUnit, setWeightUnit, formatTemperature]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error('useUnits must be used within UnitsProvider');
  }
  return context;
}
