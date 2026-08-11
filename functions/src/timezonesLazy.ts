import type { TimezoneOption } from './timezones';

// Lazy access to the large (1,900+ line) country→timezone table so it is
// code-split into its own chunk and only downloaded when a screen actually
// needs to populate a timezone dropdown. The `import type` above is erased at
// build time and does not pull the table into the bundle.
let cached: Promise<typeof import('./timezones')> | null = null;

const loadModule = (): Promise<typeof import('./timezones')> => {
  if (!cached) cached = import('./timezones');
  return cached;
};

/** Dynamically load the timezone options for a country. */
export const loadTimezonesForCountry = async (countryName: string): Promise<TimezoneOption[]> => {
  const mod = await loadModule();
  return mod.getTimezonesForCountry(countryName);
};

export type { TimezoneOption };
