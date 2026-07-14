import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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

  it('returns null if names are empty or only whitespace', async () => {
    const result = await verifyIcfCredential(' ', '');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns null if the network response is not ok', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 500
    });

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('returns null if fetch throws an error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (globalThis.fetch as unknown as Mock).mockRejectedValue(new Error('Network error'));

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('returns null if tblResults table is not present in response', async () => {
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      text: async () => '<div>No table here</div>'
    });

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    expect(result).toBeNull();
  });

  it('skips rows with missing cells or cells that do not match the user name', async () => {
    const htmlWithMismatches = `
      <table id="tblResults">
        <tr><th>Header</th></tr>
        <tr><td>Short Row</td></tr>
        <tr>
          <td>John Doe</td>
          <td>Yes</td>
          <td>ACC 12/2026</td>
        </tr>
      </table>
    `;
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlWithMismatches
    });

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    expect(result).toBeNull();
  });

  it('parses ACC credential and ignores empty lines/bad lines', async () => {
    const htmlAcc = `
      <table id="tblResults">
        <tr><th>Header</th></tr>
        <tr>
          <td>Premkumar Masilamani</td>
          <td>Yes</td>
          <td><br>ACC 12/2026<br><br>INVALID 12/2026</td>
        </tr>
      </table>
    `;
    (globalThis.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlAcc
    });

    const result = await verifyIcfCredential('Premkumar', 'Masilamani');
    expect(result).toEqual(['ICF ACC']);
  });
});
