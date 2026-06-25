import { Timestamp } from 'firebase/firestore';
import { type IcfCredential, ICF_DIRECTORY_URL } from '../config';

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
): Promise<IcfCredential | null> => {
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
          const credCell = cells[2].textContent?.trim() || '';
          if (credCell) {
            // e.g. "ACC 3/2025 - 3/2028" or just "ACC"
            const match = credCell.match(/^([A-Z]{3})(?:\s+.*-\s+(\d{1,2})\/(\d{4}))?/);
            if (match) {
              const level = match[1];
              let expiryDate: Date;
              if (match[2] && match[3]) {
                const month = parseInt(match[2], 10);
                const year = parseInt(match[3], 10);
                // day 0 of month 'month' gives the last day of the previous month (which is the target month because month is 0-indexed)
                // e.g. year = 2028, month = 3 -> new Date(2028, 3, 0) = March 31, 2028
                expiryDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
              } else {
                // Fallback if no date is found but credential exists
                const now = new Date();
                expiryDate = new Date(Date.UTC(now.getFullYear() + 1, 11, 31, 23, 59, 59));
              }

              return {
                level,
                expiryDate: Timestamp.fromDate(expiryDate)
              };
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
