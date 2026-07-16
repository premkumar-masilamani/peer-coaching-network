import { describe, it, expect } from 'vitest';
import {
  getCredentialDescription,
  getCredentialBadgeClass,
  buildDisplayCredentials
} from '../credentials';

describe('credentials helpers', () => {
  describe('getCredentialDescription', () => {
    it('correctly returns descriptions for MCC, PCC, ACC', () => {
      expect(getCredentialDescription('ICF MCC')).toBe('Master Certified Coach');
      expect(getCredentialDescription('ICF PCC')).toBe('Professional Certified Coach');
      expect(getCredentialDescription('ICF ACC')).toBe('Associate Certified Coach');
      expect(getCredentialDescription('ICF ACTC')).toBe('Advanced Certification in Team Coaching');
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
      expect(getCredentialBadgeClass('ICF ACTC')).toBe('badge-actc');
      expect(getCredentialBadgeClass('Random')).toBe('badge-acc');
    });
  });

  describe('buildDisplayCredentials', () => {

    it('handles single credentials', () => {
      expect(buildDisplayCredentials({ icf_mcc: true })).toEqual(['ICF MCC']);
      expect(buildDisplayCredentials({ icf_pcc: true })).toEqual(['ICF PCC']);
      expect(buildDisplayCredentials({ icf_acc: true })).toEqual(['ICF ACC']);
      expect(buildDisplayCredentials({ icf_actc: true })).toEqual(['ICF ACTC']);
    });

    it('handles combinations with ACTC', () => {
      expect(buildDisplayCredentials({ icf_mcc: true, icf_actc: true })).toEqual(['ICF MCC', 'ICF ACTC']);
      expect(buildDisplayCredentials({ icf_pcc: true, icf_actc: true })).toEqual(['ICF PCC', 'ICF ACTC']);
      expect(buildDisplayCredentials({ icf_acc: true, icf_actc: true })).toEqual(['ICF ACC', 'ICF ACTC']);
    });

    it('handles empty profile credentials', () => {
      expect(buildDisplayCredentials({})).toEqual([]);
    });

    it('returns all credentials without prioritization', () => {
      expect(buildDisplayCredentials({ icf_mcc: true, icf_pcc: true, icf_acc: true })).toEqual(['ICF MCC', 'ICF PCC', 'ICF ACC']);
      expect(buildDisplayCredentials({ icf_pcc: true, icf_acc: true })).toEqual(['ICF PCC', 'ICF ACC']);
    });
  });
});
