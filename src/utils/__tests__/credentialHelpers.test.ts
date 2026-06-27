import { describe, it, expect, vi } from 'vitest';
import type { IcfCredential } from '../../config';
import {
  isCredentialValid,
  filterValidCredentials,
  mapIcfLevelToQualification,
  getPrimaryCredential,
  getDisplayCredentials,
} from '../credentialHelpers';
import { QUALIFICATION } from '../../config';

// ---------------------------------------------------------------------------
// Helpers — create IcfCredential with a fake Timestamp whose toDate() returns
// a real Date object so the real logic can compare against `new Date()`.
// ---------------------------------------------------------------------------

const makeCredential = (level: string, expiryDate: Date): IcfCredential => ({
  level,
  expiryDate: {
    toDate: () => expiryDate,
  } as IcfCredential['expiryDate'],
});

const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // +1 year
const PAST   = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // -1 year

// ---------------------------------------------------------------------------
// isCredentialValid
// ---------------------------------------------------------------------------

describe('credentialHelpers', () => {
  describe('isCredentialValid', () => {
    it('returns true when expiry is in the future', () => {
      expect(isCredentialValid(makeCredential('ACC', FUTURE))).toBe(true);
    });

    it('returns false when expiry is in the past', () => {
      expect(isCredentialValid(makeCredential('ACC', PAST))).toBe(false);
    });

    it('returns true for a credential expiring right now (boundary)', () => {
      const fakeNow = new Date();
      // Mock Date.now() so "now" and expiryDate are the same millisecond
      const nowMs = fakeNow.getTime();
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);
      const cred = makeCredential('PCC', new Date(nowMs));
      // expiryDate >= now is true (same moment)
      expect(isCredentialValid(cred)).toBe(true);
      vi.restoreAllMocks();
    });
  });

  // ---------------------------------------------------------------------------
  // filterValidCredentials
  // ---------------------------------------------------------------------------

  describe('filterValidCredentials', () => {
    it('returns empty array when input is undefined', () => {
      expect(filterValidCredentials(undefined)).toEqual([]);
    });

    it('returns empty array when input is empty', () => {
      expect(filterValidCredentials([])).toEqual([]);
    });

    it('filters out expired credentials and keeps valid ones', () => {
      const valid = makeCredential('MCC', FUTURE);
      const expired = makeCredential('ACC', PAST);
      const result = filterValidCredentials([valid, expired]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(valid);
    });

    it('returns all credentials when all are valid', () => {
      const c1 = makeCredential('ACC', FUTURE);
      const c2 = makeCredential('PCC', FUTURE);
      const result = filterValidCredentials([c1, c2]);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when all credentials are expired', () => {
      const c1 = makeCredential('ACC', PAST);
      const c2 = makeCredential('PCC', PAST);
      expect(filterValidCredentials([c1, c2])).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // mapIcfLevelToQualification
  // ---------------------------------------------------------------------------

  describe('mapIcfLevelToQualification', () => {
    it('maps MCC variants to QUALIFICATION.MCC', () => {
      expect(mapIcfLevelToQualification('MCC')).toBe(QUALIFICATION.MCC);
      expect(mapIcfLevelToQualification('ICF MCC')).toBe(QUALIFICATION.MCC);
      expect(mapIcfLevelToQualification('mcc')).toBe(QUALIFICATION.MCC);
    });

    it('maps PCC variants to QUALIFICATION.PCC', () => {
      expect(mapIcfLevelToQualification('PCC')).toBe(QUALIFICATION.PCC);
      expect(mapIcfLevelToQualification('ICF PCC')).toBe(QUALIFICATION.PCC);
    });

    it('maps ACC variants to QUALIFICATION.ACC', () => {
      expect(mapIcfLevelToQualification('ACC')).toBe(QUALIFICATION.ACC);
      expect(mapIcfLevelToQualification('ICF ACC')).toBe(QUALIFICATION.ACC);
    });

    it('maps ACTC variants to QUALIFICATION.ACTC', () => {
      expect(mapIcfLevelToQualification('ACTC')).toBe(QUALIFICATION.ACTC);
      expect(mapIcfLevelToQualification('ICF ACTC')).toBe(QUALIFICATION.ACTC);
    });

    it('returns undefined for unrecognised level strings', () => {
      expect(mapIcfLevelToQualification('Unknown')).toBeUndefined();
      expect(mapIcfLevelToQualification('')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getPrimaryCredential
  // ---------------------------------------------------------------------------

  describe('getPrimaryCredential', () => {
    it('returns null when input is undefined', () => {
      expect(getPrimaryCredential(undefined)).toBeNull();
    });

    it('returns null when input is empty', () => {
      expect(getPrimaryCredential([])).toBeNull();
    });

    it('returns null when all credentials are expired', () => {
      const cred = makeCredential('PCC', PAST);
      expect(getPrimaryCredential([cred])).toBeNull();
    });

    it('returns null when only non-core credentials (ACTC) are present', () => {
      const cred = makeCredential('ACTC', FUTURE);
      expect(getPrimaryCredential([cred])).toBeNull();
    });

    it('returns the single valid core credential', () => {
      const acc = makeCredential('ACC', FUTURE);
      expect(getPrimaryCredential([acc])).toBe(acc);
    });

    it('prefers MCC over PCC over ACC', () => {
      const acc = makeCredential('ACC', FUTURE);
      const pcc = makeCredential('PCC', FUTURE);
      const mcc = makeCredential('MCC', FUTURE);
      expect(getPrimaryCredential([acc, pcc, mcc])).toBe(mcc);
      expect(getPrimaryCredential([acc, pcc])).toBe(pcc);
      expect(getPrimaryCredential([acc])).toBe(acc);
    });

    it('ignores expired credentials when determining primary', () => {
      const expiredMcc = makeCredential('MCC', PAST);
      const validPcc = makeCredential('PCC', FUTURE);
      expect(getPrimaryCredential([expiredMcc, validPcc])).toBe(validPcc);
    });

    it('handles prefixed level strings like "ICF MCC"', () => {
      const icfMcc = makeCredential('ICF MCC', FUTURE);
      const pcc = makeCredential('PCC', FUTURE);
      expect(getPrimaryCredential([pcc, icfMcc])).toBe(icfMcc);
    });
  });

  // ---------------------------------------------------------------------------
  // getDisplayCredentials
  // ---------------------------------------------------------------------------

  describe('getDisplayCredentials', () => {
    it('returns empty array when input is undefined', () => {
      expect(getDisplayCredentials(undefined)).toEqual([]);
    });

    it('returns empty array when no valid credentials exist', () => {
      const expired = makeCredential('MCC', PAST);
      expect(getDisplayCredentials([expired])).toEqual([]);
    });

    it('returns only the highest core credential when no specialized ones exist', () => {
      const acc = makeCredential('ACC', FUTURE);
      const pcc = makeCredential('PCC', FUTURE);
      const result = getDisplayCredentials([acc, pcc]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(pcc);
    });

    it('returns the highest core credential alongside all specialized credentials', () => {
      const acc = makeCredential('ACC', FUTURE);
      const pcc = makeCredential('PCC', FUTURE);
      const actc = makeCredential('ACTC', FUTURE);
      const result = getDisplayCredentials([acc, pcc, actc]);
      // PCC is the primary; ACTC is kept; ACC is dropped
      expect(result).toHaveLength(2);
      expect(result).toContain(pcc);
      expect(result).toContain(actc);
      expect(result).not.toContain(acc);
    });

    it('returns only specialized credentials when no core credentials exist', () => {
      const actc = makeCredential('ACTC', FUTURE);
      // getPrimaryCredential returns null for pure ACTC, so only actc appears
      const result = getDisplayCredentials([actc]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(actc);
    });

    it('excludes expired specialized credentials', () => {
      const pcc = makeCredential('PCC', FUTURE);
      const expiredActc = makeCredential('ACTC', PAST);
      const result = getDisplayCredentials([pcc, expiredActc]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(pcc);
    });
  });
});

