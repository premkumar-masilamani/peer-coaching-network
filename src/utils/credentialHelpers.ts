import type { IcfCredential, Qualification } from '../config';
import { QUALIFICATION } from '../config';

/**
 * Returns true if the credential is valid (expiry date is in the future).
 */
export const isCredentialValid = (credential: IcfCredential): boolean => {
  const now = new Date();
  const expiryDate = credential.expiryDate.toDate();
  return expiryDate >= now;
};

/**
 * Filters out expired credentials, returning only valid ones.
 */
export const filterValidCredentials = (credentials?: IcfCredential[]): IcfCredential[] => {
  if (!credentials) return [];
  return credentials.filter(isCredentialValid);
};

/**
 * Maps an ICF credential level string to the internal Qualification type.
 * Default mapping for 'ACC', 'PCC', 'MCC'.
 */
export const mapIcfLevelToQualification = (level: string): Qualification | undefined => {
  const upper = level.toUpperCase();
  if (upper.includes('MCC')) return QUALIFICATION.MCC;
  if (upper.includes('PCC')) return QUALIFICATION.PCC;
  if (upper.includes('ACC')) return QUALIFICATION.ACC;
  return undefined;
};

/**
 * Returns the highest valid credential from a list of credentials,
 * or null if no valid credentials exist.
 * The order of precedence is MCC > PCC > ACC.
 */
export const getPrimaryCredential = (credentials?: IcfCredential[]): IcfCredential | null => {
  const valid = filterValidCredentials(credentials);
  if (valid.length === 0) return null;

  const order = ['MCC', 'PCC', 'ACC'];
  
  valid.sort((a, b) => {
    const aLevel = a.level.toUpperCase();
    const bLevel = b.level.toUpperCase();
    
    let aRank = order.findIndex(o => aLevel.includes(o));
    let bRank = order.findIndex(o => bLevel.includes(o));
    
    if (aRank === -1) aRank = 999;
    if (bRank === -1) bRank = 999;
    
    return aRank - bRank;
  });

  return valid[0] || null;
};
