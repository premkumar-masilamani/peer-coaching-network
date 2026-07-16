export const getCredentialDescription = (q: string): string => {
  if (q === 'ICF ACC') return 'Associate Certified Coach';
  if (q === 'ICF PCC') return 'Professional Certified Coach';
  if (q === 'ICF MCC') return 'Master Certified Coach';
  if (q === 'ICF ACTC') return 'Advanced Certification in Team Coaching';
  return q;
};

export const getCredentialBadgeClass = (q: string): string => {
  if (q === 'ICF PCC') return 'badge-pcc';
  if (q === 'ICF MCC') return 'badge-mcc';
  if (q === 'ICF ACTC') return 'badge-actc';
  return 'badge-acc';
};

export const buildDisplayCredentials = (profile: { icf_mcc?: boolean, icf_pcc?: boolean, icf_acc?: boolean, icf_actc?: boolean }): string[] => {
  const displayCredentials: string[] = [];
  if (profile.icf_mcc) displayCredentials.push('ICF MCC');
  if (profile.icf_pcc) displayCredentials.push('ICF PCC');
  if (profile.icf_acc) displayCredentials.push('ICF ACC');
  
  if (profile.icf_actc) displayCredentials.push('ICF ACTC');
  return displayCredentials;
};
