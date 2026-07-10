import { type Qualification, ICF_DIRECTORY_URL } from '../config';

/**
 * Validates a user's credentials against the public ICF Coach Directory.
 * Fetches the ICF directory HTML directly and parses the results table.
 * 
 * Note: If the directory does not expose an expiration date,
 * we estimate it based on active status, or fall back to a default value.
 */
export const verifyIcfCredential = async (
  firstName: string,
  lastName: string
): Promise<Qualification[] | null> => {
  try {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn && !ln) return null;

    // Use the exact URL requested by the user
    const url = ICF_DIRECTORY_URL
      .replace('{firstName}', encodeURIComponent(fn))
      .replace('{lastName}', encodeURIComponent(ln));
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('ICF Directory returned an error:', response.status);
      return null;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const resultsTable = doc.getElementById('tblResults');
    if (!resultsTable) {
      return null;
    }

    const rows = resultsTable.querySelectorAll('tr');
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        const nameCell = cells[0].textContent?.trim().toLowerCase() || '';
        // Check if the row matches the user's name
        if (nameCell.includes(fn.toLowerCase()) && nameCell.includes(ln.toLowerCase())) {
          const credCellHtml = cells[2].innerHTML || '';
          if (credCellHtml) {
            // Split by <br> or <br/> to handle multiple credentials
            const credLines = credCellHtml.split(/<br\s*\/?>/i);
            const qualifications: Qualification[] = [];

            for (const line of credLines) {
              const cleanLine = line.replace(/<[^>]+>/g, '').trim();
              if (!cleanLine) continue;

              const match = cleanLine.match(/^([A-Z]{3,4})/);
              if (match) {
                const level = match[1].toUpperCase();
                let qual: Qualification | undefined;
                if (level.includes('MCC')) qual = 'ICF MCC';
                else if (level.includes('PCC')) qual = 'ICF PCC';
                else if (level.includes('ACC')) qual = 'ICF ACC';
                else if (level.includes('ACTC')) qual = 'ICF ACTC';

                if (qual && !qualifications.includes(qual)) {
                  qualifications.push(qual);
                }
              }
            }

            if (qualifications.length > 0) {
              return qualifications;
            }
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to verify ICF credentials:', err);
    return null;
  }
};
