import { describe, it, expect } from 'vitest';
import {
  getShortCredential,
  getCredentialDescription,
  getCredentialBadgeClass
} from '../credentials';

describe('credentials helpers', () => {
  describe('getShortCredential', () => {
    it('correctly maps standard credentials', () => {
      expect(getShortCredential('ICF MCC')).toBe('ICF MCC');
      expect(getShortCredential('ICF PCC')).toBe('ICF PCC');
      expect(getShortCredential('ICF ACC')).toBe('ICF ACC');
      expect(getShortCredential('ICF ACTC')).toBe('ICF ACTC');
    });

    it('returns original string if no mapping matches', () => {
      expect(getShortCredential('Other')).toBe('Other');
      expect(getShortCredential('')).toBe('');
    });
  });

  describe('getCredentialDescription', () => {
    it('correctly returns descriptions for MCC, PCC, ACC', () => {
      expect(getCredentialDescription('ICF MCC')).toBe('Master Certified Coach');
      expect(getCredentialDescription('ICF PCC')).toBe('Professional Certified Coach');
      expect(getCredentialDescription('ICF ACC')).toBe('Associate Certified Coach');
    });

    it('returns original string if unrecognized', () => {
      expect(getCredentialDescription('Unrecognized')).toBe('Unrecognized');
    });
  });

  describe('getCredentialBadgeClass', () => {
    it('returns correct class names for badges', () => {
      expect(getCredentialBadgeClass('ICF MCC')).toBe('badge-mcc');
      expect(getCredentialBadgeClass('ICF PCC')).toBe('badge-pcc');
      expect(getCredentialBadgeClass('ICF ACC')).toBe('badge-acc');
      expect(getCredentialBadgeClass('Random')).toBe('badge-acc');
    });
  });
});
