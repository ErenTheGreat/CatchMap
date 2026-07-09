import { describe, it, expect } from 'vitest';
import { parseVoiceCatchTranscript } from '@/utils/voiceCatchParser';

describe('parseVoiceCatchTranscript', () => {
  it('extracts species, length, and lure', () => {
    const parsed = parseVoiceCatchTranscript('18 inch largemouth bass on texas rig');
    expect(parsed.species).toBe('Largemouth Bass');
    expect(parsed.length).toBe('18 in');
    expect(parsed.lure?.toLowerCase()).toContain('texas rig');
  });

  it('extracts weight', () => {
    const parsed = parseVoiceCatchTranscript('Caught a 4.5 lb walleye');
    expect(parsed.species).toBe('Walleye');
    expect(parsed.weight).toBe('4.5 lb');
  });
});
