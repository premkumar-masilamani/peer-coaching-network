import { describe, it, expect } from 'vitest';
import {
  getShortCredential,
  getCredentialDescription,
  getCredentialBadgeClass
} from '../credentials';

describe('credentials helpers', () => {
  describe('getShortCredential', () => {
    it('correctly maps standard credentials', () => {
      expect(getShortCredential('MCC')).toBe('MCC');
      expect(getShortCredential('ICF MCC')).toBe('MCC');
      expect(getShortCredential('PCC')).toBe('PCC');
      expect(getShortCredential('ICF PCC')).toBe('PCC');
      expect(getShortCredential('ACC')).toBe('ACC');
      expect(getShortCredential('ICF ACC')).toBe('ACC');
    });

    it('returns original string if no mapping matches', () => {
      expect(getShortCredential('Other')).toBe('Other');
      expect(getShortCredential('')).toBe('');
    });
  });

  describe('getCredentialDescription', () => {
    it('correctly returns descriptions for MCC, PCC, ACC', () => {
      expect(getCredentialDescription('MCC')).toBe('Master Certified Coach');
      expect(getCredentialDescription('ICF PCC')).toBe('Professional Certified Coach');
      expect(getCredentialDescription('ACC')).toBe('Associate Certified Coach');
    });

    it('returns original string if unrecognized', () => {
      expect(getCredentialDescription('Unrecognized')).toBe('Unrecognized');
    });
  });

  describe('getCredentialBadgeClass', () => {
    it('returns correct class names for badges', () => {
      expect(getCredentialBadgeClass('MCC')).toBe('badge-mcc');
      expect(getCredentialBadgeClass('PCC')).toBe('badge-pcc');
      expect(getCredentialBadgeClass('ACC')).toBe('badge-acc');
      expect(getCredentialBadgeClass('Random')).toBe('badge-acc');
    });
  });
});
