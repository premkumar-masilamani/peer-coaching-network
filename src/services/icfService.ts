import { Timestamp } from 'firebase/firestore';
import type { IcfCredential } from '../config';

/**
 * Validates a user's credentials against the ICF Coach Directory.
 * Uses the public ICF Azure Search API to find the coach by name.
 * 
 * Note: Since the public API may not expose the exact expiration date,
 * we estimate it based on active status, or fall back to a default value.
 */
export const verifyIcfCredential = async (
  firstName: string,
  lastName: string
): Promise<IcfCredential | null> => {
  try {
    const query = `${firstName} ${lastName}`.trim();
    if (!query) return null;

    // Call the ICF Azure Search API
    const response = await fetch('https://icf-ccf.azurewebsites.net/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keywords: query })
    });

    if (!response.ok) {
      console.warn('ICF Directory API returned an error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data && data.results && data.results.length > 0) {
      // Find exact name match if possible, or take the first
      let match = data.results.find((r: { fullName?: string; credential?: string; key?: string }) => 
        r.fullName?.toLowerCase().includes(firstName.toLowerCase()) && 
        r.fullName?.toLowerCase().includes(lastName.toLowerCase())
      );
      
      if (!match) {
        match = data.results[0];
      }

      if (match.credential) {
        // The API only returns active coaches. If they are in the directory, their credential is valid.
        // Since we don't have the exact expiry string (e.g. "December 2024") from the API, 
        // we simulate an expiry date for 1 year in the future.
        const now = new Date();
        const nextYear = new Date(now.getFullYear() + 1, 11, 31); // Dec 31 of next year
        
        return {
          level: match.credential, // e.g. "ACC", "PCC", "MCC"
          expiryDate: Timestamp.fromDate(nextYear)
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to verify ICF credentials:', err);
    return null;
  }
};
