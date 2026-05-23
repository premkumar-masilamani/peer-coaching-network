export const getShortCredential = (q: string): string => {
  if (q.includes('MCC') || q === 'MCC') return 'MCC';
  if (q.includes('PCC') || q === 'PCC') return 'PCC';
  if (q.includes('ACC') || q === 'ACC') return 'ACC';
  return q;
};

export const getCredentialDescription = (q: string): string => {
  const short = getShortCredential(q);
  if (short === 'ACC') return 'Associate Certified Coach';
  if (short === 'PCC') return 'Professional Certified Coach';
  if (short === 'MCC') return 'Master Certified Coach';
  return q;
};

export const getCredentialBadgeClass = (q: string): string => {
  const short = getShortCredential(q);
  if (short === 'PCC') return 'badge-pcc';
  if (short === 'MCC') return 'badge-mcc';
  return 'badge-acc';
};
