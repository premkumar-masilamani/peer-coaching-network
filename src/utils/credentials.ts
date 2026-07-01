export const getShortCredential = (q: string): string => {
  if (q.includes('MCC') || q === 'MCC') return 'ICF MCC';
  if (q.includes('PCC') || q === 'PCC') return 'ICF PCC';
  if (q.includes('ACC') || q === 'ACC') return 'ICF ACC';
  if (q.includes('ACTC') || q === 'ACTC') return 'ICF ACTC';
  return q;
};

export const getCredentialDescription = (q: string): string => {
  const short = getShortCredential(q);
  if (short === 'ICF ACC') return 'Associate Certified Coach';
  if (short === 'ICF PCC') return 'Professional Certified Coach';
  if (short === 'ICF MCC') return 'Master Certified Coach';
  if (short === 'ICF ACTC') return 'Advanced Certification in Team Coaching';
  return q;
};

export const getCredentialBadgeClass = (q: string): string => {
  const short = getShortCredential(q);
  if (short === 'ICF PCC') return 'badge-pcc';
  if (short === 'ICF MCC') return 'badge-mcc';
  if (short === 'ICF ACTC') return 'badge-actc';
  return 'badge-acc';
};
