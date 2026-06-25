import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyIcfCredential } from '../icfService';

const mockHtml = `
<table id="tblResults" class="table table-striped table-bordered dirsearchresults">
<tbody><tr>
<th>Name</th>
<th>ICF Member</th>
<th>ICF Credential</th>
<th>Location</th>
</tr>
<tr>
<td>Premkumar Masilamani</td>
<td>Yes</td>
<td>PCC  5/2025 - 4/2026<br>MCC  4/2026 - 4/2029</td>
<td>Bengaluru, INDIA</td>
</tr>
</tbody></table>
`;

import { type Mock } from 'vitest';

describe('verifyIcfCredential', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as Mock;
  });

  it('parses multiple credentials and selects the highest one (MCC)', async () => {
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml
    });

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    
    expect(result).not.toBeNull();
    expect(result?.level).toBe('MCC');
    
    // Month is 4. parseInt('4') -> 4. 
    // new Date(Date.UTC(2029, 4, 0, 23, 59, 59)) -> month 4 is May. Day 0 of May is April 30.
    const expectedDate = new Date(Date.UTC(2029, 4, 0, 23, 59, 59));
    expect(result?.expiryDate.toDate().toISOString()).toBe(expectedDate.toISOString());
  });
});
