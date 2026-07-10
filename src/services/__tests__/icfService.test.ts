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
<td>PCC  5/2025 - 4/2026<br>MCC  4/2026 - 4/2029<br>ACTC  12/2026 - 12/2029</td>
<td>Bengaluru, INDIA</td>
</tr>
</tbody></table>
`;

import { type Mock } from 'vitest';

describe('verifyIcfCredential', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as Mock;
  });

  it('parses multiple credentials and returns all valid credentials', async () => {
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml
    });

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    
    expect(result).not.toBeNull();
    expect(result?.length).toBe(3);
    
    expect(result?.[0]).toBe('ICF PCC');
    expect(result?.[1]).toBe('ICF MCC');
    expect(result?.[2]).toBe('ICF ACTC');
  });
});
