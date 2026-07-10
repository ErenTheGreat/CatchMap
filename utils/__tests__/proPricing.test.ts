import { describe, expect, it } from 'vitest';
import { formatProPriceLabel, getProDisplayPrice } from '@/constants/pro';

describe('pro pricing helpers', () => {
  it('returns monthly fallback price', () => {
    expect(getProDisplayPrice()).toBe('$3.99/mo');
  });

  it('appends /mo when store price omits period', () => {
    expect(formatProPriceLabel('$3.99')).toBe('$3.99/mo');
    expect(formatProPriceLabel('€3,99')).toBe('€3,99/mo');
  });

  it('preserves store price when period is included', () => {
    expect(formatProPriceLabel('$3.99/month')).toBe('$3.99/month');
    expect(formatProPriceLabel('$3.99/mo')).toBe('$3.99/mo');
  });

  it('falls back when store price is empty', () => {
    expect(formatProPriceLabel(null)).toBe('$3.99/mo');
    expect(formatProPriceLabel(undefined)).toBe('$3.99/mo');
  });
});
