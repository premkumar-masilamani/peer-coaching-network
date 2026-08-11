"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTimezonesForCountry = void 0;
// Lazy access to the large (1,900+ line) country→timezone table so it is
// code-split into its own chunk and only downloaded when a screen actually
// needs to populate a timezone dropdown. The `import type` above is erased at
// build time and does not pull the table into the bundle.
let cached = null;
const loadModule = () => {
    if (!cached)
        cached = Promise.resolve().then(() => require('./timezones'));
    return cached;
};
/** Dynamically load the timezone options for a country. */
const loadTimezonesForCountry = async (countryName) => {
    const mod = await loadModule();
    return mod.getTimezonesForCountry(countryName);
};
exports.loadTimezonesForCountry = loadTimezonesForCountry;
//# sourceMappingURL=timezonesLazy.js.map