/**
 * seed-emulator.cjs
 *
 * Initialises seed users in the local Firebase emulator.
 * Run after `make emulator` is up: `node scripts/seed-emulator.cjs`
 * (also invoked automatically by `make local`)
 *
 * User definitions live in scripts/seed-users.json — edit that file to
 * add, remove, or modify test users without touching this script.
 *
 * Each user is created via the same API used by the emulator's own
 * "Sign in with Google.com" button (accounts:signInWithIdp), so they
 * appear in the emulator's Google account picker immediately.
 *
 * The script is fully idempotent: signInWithIdp with the same Google sub
 * always returns the same Firebase UID, and all Firestore writes are
 * skip-if-exists or use batch.set() (inherently idempotent).
 */

'use strict';

// ── Point Admin SDK at the local emulators ────────────────────────────────────
// These must be set before the first require('firebase-admin/…') call.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const path = require('path');
const fs   = require('fs');

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

// ── Constants (mirrors src/config) ───────────────────────────────────────────
const PROJECT_ID = 'peer-coaching-network-dev';

/** Auth emulator base URL. */
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

/** Number of future days for which availability is pre-computed. */
const BOOKING_HORIZON_DAYS = 30;

/**
 * The booking UI starts from tomorrow, not today.
 * Mirrors BOOKING_START_OFFSET_DAYS in src/config/constants.ts.
 */
const BOOKING_START_OFFSET_DAYS = 1;

/** Slot duration in minutes — must match SLOT_DURATION_MS / 60000 in src/config. */
const SLOT_DURATION_MINUTES = 30;

const COLLECTIONS = {
  USERS: 'users',
  SCHEDULE: 'schedule',
  AVAILABLE_DAYS: 'availableDays',
  BLOCKED_DATES: 'blockedDates',
  PERSONAL_AVAILABILITY_CACHE: 'personalAvailabilityCache',
  COACH_AVAILABILITY_BY_DATE: 'coachAvailabilityByDate',
};

/** Required fields every entry in seed-users.json must have. */
const REQUIRED_USER_FIELDS = [
  'firstName', 'lastName', 'email', 'role', 'status',
  'gender', 'country', 'timezone', 'bio',
];

// ── Firebase Admin initialisation (Firestore only — Auth handled via HTTP) ───
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);

// ── Emulator Google Sign-In helpers ──────────────────────────────────────────

/**
 * Build a minimal unsigned JWT that the Auth emulator accepts for
 * accounts:signInWithIdp. The emulator never validates the signature —
 * it only decodes the payload to extract user info.
 *
 * Using `email` as the Google `sub` (provider UID) is intentional:
 * it gives us a deterministic, human-readable Google user ID so that
 * re-seeding the same user always resolves to the same Firebase UID.
 */
function buildFakeGoogleIdToken(email, displayName) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  const header  = b64({ alg: 'RS256', kid: 'fake', typ: 'JWT' });
  const now     = Math.floor(Date.now() / 1000);
  const payload = b64({
    iss: 'https://accounts.google.com',
    aud: PROJECT_ID,
    sub: email,            // Google user ID — we use email for determinism
    email,
    email_verified: true,
    name: displayName,
    iat: now,
    exp: now + 3600,
  });

  // Signature is ignored by the emulator
  return `${header}.${payload}.fake-signature`;
}

/**
 * Sign in (or create) a user via the Auth emulator's signInWithIdp endpoint —
 * the exact same API that the emulator's "Sign in with Google.com" button uses.
 *
 * The call is idempotent: the same Google `sub` (email) always returns the
 * same Firebase UID, whether the account already exists or not.
 *
 * @returns {Promise<string>} Firebase UID (`localId` in the response)
 */
async function signInWithGoogleEmulator(email, displayName) {
  const idToken = buildFakeGoogleIdToken(email, displayName);

  const url = `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestUri: 'http://localhost',
      postBody: `providerId=google.com&id_token=${idToken}`,
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`signInWithIdp failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.localId;
}

// ── Timezone helpers (faithfully ported from src/utils/timezoneHelpers.ts) ────

/** Return the 24-hour value from Intl.DateTimeFormat parts. */
function getHour24(parts) {
  let hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;
  if (dayPeriod) {
    const dp = dayPeriod.toLowerCase();
    if ((dp.includes('pm') || dp === 'pm') && hour < 12) hour += 12;
    else if ((dp.includes('am') || dp === 'am') && hour === 12) hour = 0;
  }
  return hour;
}

/**
 * Fixed-point UTC ↔ local time conversion.
 * Mirrors getUtcForLocalDateTime from src/utils/timezoneHelpers.ts exactly,
 * including the DST convergence loop and day-diff calculation.
 */
function getUtcForLocalDateTime(year, month, day, hour, minute, timeZone) {
  let utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  for (let i = 0; i < 5; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(utcGuess);

    const tzYear   = parseInt(parts.find(p => p.type === 'year').value, 10);
    const tzMonth  = parseInt(parts.find(p => p.type === 'month').value, 10);
    const tzDay    = parseInt(parts.find(p => p.type === 'day').value, 10);
    const tzHour   = getHour24(parts);
    const tzMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);

    const targetMinutes  = hour * 60 + minute;
    const currentMinutes = tzHour * 60 + tzMinute;

    const targetDate  = new Date(Date.UTC(year, month - 1, day, 0, 0));
    const currentDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, 0, 0));
    const dayDiff     = (targetDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);

    const diffMinutes = dayDiff * 24 * 60 + (targetMinutes - currentMinutes);
    if (diffMinutes === 0) break;

    utcGuess = new Date(utcGuess.getTime() + diffMinutes * 60 * 1000);
  }

  return utcGuess;
}

/**
 * Return the local calendar date (plain Date, time zeroed) for a given UTC
 * instant in the specified timezone. Mirrors getLocalDateInTimezone.
 */
function getLocalDateInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);

  const y = parseInt(parts.find(p => p.type === 'year').value, 10);
  const m = parseInt(parts.find(p => p.type === 'month').value, 10);
  const d = parseInt(parts.find(p => p.type === 'day').value, 10);

  return new Date(y, m - 1, d);
}

// ── Default available days (mirrors DEFAULT_AVAILABLE_DAYS in slotsService.ts) ─
function makeTimeTimestamp(utcHour, utcMinute) {
  return Timestamp.fromDate(new Date(Date.UTC(1970, 0, 1, utcHour, utcMinute, 0, 0)));
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DEFAULT_AVAILABLE_DAYS = {
  monday:    { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  tuesday:   { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  wednesday: { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  thursday:  { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  friday:    { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  saturday:  { enabled: false, slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  sunday:    { enabled: false, slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
};

/** Convert a stored time Timestamp (epoch-based, UTC) to { hour, minute }. */
function timestampToUtcHourMinute(ts) {
  const d = ts.toDate();
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/**
 * Generate available slot ISO strings for a single calendar date.
 * Faithfully mirrors generateSlotsForDate from src/services/slotsService.ts,
 * using 30-minute increments to match SLOT_DURATION_MINUTES.
 */
function generateSlotsForDate(date, availableDays, blockedDates, timezone) {
  const year  = date.getFullYear();
  const month = date.getMonth() + 1;
  const day   = date.getDate();

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (blockedDates.includes(dateStr)) return [];

  const dayName  = DAYS_OF_WEEK[date.getDay()];
  const daySched = availableDays[dayName] || { enabled: false, slots: [] };

  if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) return [];

  const slots = [];
  for (const slot of daySched.slots) {
    const { hour: startHour, minute: startMinute } = timestampToUtcHourMinute(slot.startTime);
    const { hour: endHour,   minute: endMinute }   = timestampToUtcHourMinute(slot.endTime);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes   = endHour   * 60 + endMinute;

    for (let min = startTotalMinutes; min < endTotalMinutes; min += SLOT_DURATION_MINUTES) {
      const slotHour   = Math.floor(min / 60);
      const slotMinute = min % 60;
      slots.push(getUtcForLocalDateTime(year, month, day, slotHour, slotMinute, timezone).toISOString());
    }
  }
  return slots;
}

/**
 * Compute availability for the booking horizon.
 * Starts at BOOKING_START_OFFSET_DAYS (tomorrow) — matches the booking UI.
 */
function computeAvailability(timezone) {
  const localToday = getLocalDateInTimezone(new Date(), timezone);
  const allSlots = [];

  for (let i = BOOKING_START_OFFSET_DAYS; i <= BOOKING_HORIZON_DAYS; i++) {
    const currentDate = new Date(localToday);
    currentDate.setDate(localToday.getDate() + i);
    allSlots.push(...generateSlotsForDate(currentDate, DEFAULT_AVAILABLE_DAYS, [], timezone));
  }

  const freeSlots = [...new Set(allSlots)].sort();
  const availableDatesUtc = [...new Set(freeSlots.map(s => s.split('T')[0]))].sort();

  const slotsByDate = new Map();
  for (const iso of freeSlots) {
    const dateISO = iso.split('T')[0];
    if (!slotsByDate.has(dateISO)) slotsByDate.set(dateISO, []);
    slotsByDate.get(dateISO).push(iso);
  }

  return { freeSlots, availableDatesUtc, slotsByDate };
}

// ── Input validation ──────────────────────────────────────────────────────────

function validateUsers(users) {
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('seed-users.json must be a non-empty array.');
  }
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    for (const field of REQUIRED_USER_FIELDS) {
      if (u[field] === undefined || u[field] === null) {
        throw new Error(`User at index ${i} (${u.email || '?'}) is missing required field: "${field}"`);
      }
    }
    if (u.role !== 'admin' && u.role !== 'user') {
      throw new Error(`User at index ${i} (${u.email}) has invalid role: "${u.role}". Must be "admin" or "user".`);
    }
    if (u.status !== 'active' && u.status !== 'inactive') {
      throw new Error(`User at index ${i} (${u.email}) has invalid status: "${u.status}". Must be "active" or "inactive".`);
    }
    try {
      Intl.DateTimeFormat('en-US', { timeZone: u.timezone }).format(new Date());
    } catch {
      throw new Error(`User at index ${i} (${u.email}) has invalid timezone: "${u.timezone}"`);
    }
  }
}

// ── Core seeding logic ────────────────────────────────────────────────────────

async function seedUser(userData) {
  const {
    firstName, lastName, email, role, status, gender,
    country, timezone, bio,
    // Optional — add to seed-users.json to test credentialed coaches.
    // e.g. "icf_acc": true, "icf_pcc": true
    icf_acc  = false,
    icf_pcc  = false,
    icf_mcc  = false,
    icf_actc = false,
  } = userData;

  const displayName     = `${firstName} ${lastName}`;
  const normalizedEmail = email.toLowerCase();

  // ── 1. Sign in via the emulator's Google provider API ─────────────────────
  // Uses accounts:signInWithIdp — the same endpoint the emulator's own
  // "Sign in with Google.com" button calls. This is the only approach that
  // makes accounts appear in the emulator's Google account picker.
  //
  // The call is inherently idempotent: using the same Google `sub` (email)
  // always resolves to the same Firebase UID regardless of how many times
  // the script is run.
  const uid = await signInWithGoogleEmulator(normalizedEmail, displayName);
  console.log(`  ↳ Google Sign-In via emulator API (uid: ${uid})`);

  // ── 2. Write users/{uid} Firestore document ────────────────────────────────
  const userRef  = db.collection(COLLECTIONS.USERS).doc(uid);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    console.log(`  ↳ Firestore profile already exists, skipping.`);
  } else {
    await userRef.set({
      userId: uid,
      email: normalizedEmail,
      firstName,
      lastName,
      displayName,
      photoURL: null,
      userRole: role,
      userStatus: status,
      icfCredentials: [],
      gender,
      country,
      bio,
      timezone,
      createdAt: Timestamp.now(),
      theme: 'light',
      icf_acc,
      icf_pcc,
      icf_mcc,
      icf_actc,
      onboardingComplete: status === 'active',
    });
    console.log(`  ↳ Firestore profile written.`);
  }

  // ── 3. Write schedule sub-documents ───────────────────────────────────────
  const scheduleBase    = db.collection(COLLECTIONS.USERS).doc(uid).collection(COLLECTIONS.SCHEDULE);
  const availDaysRef    = scheduleBase.doc(COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = scheduleBase.doc(COLLECTIONS.BLOCKED_DATES);

  const availDaysSnap = await availDaysRef.get();
  if (availDaysSnap.exists) {
    console.log(`  ↳ Schedule already exists, skipping.`);
  } else {
    await Promise.all([
      availDaysRef.set(DEFAULT_AVAILABLE_DAYS),
      blockedDatesRef.set({ blockedDates: [] }),
    ]);
    console.log(`  ↳ Schedule sub-documents written.`);
  }

  // ── 4. Compute & write availability caches (active coaches only) ───────────
  if (role !== 'user' || status !== 'active') {
    console.log(`  ↳ Skipping availability cache (role=${role}, status=${status}).`);
    return;
  }

  const filterFields = { gender, country, icf_acc, icf_pcc, icf_mcc, icf_actc };
  const { freeSlots, availableDatesUtc, slotsByDate } = computeAvailability(timezone);
  const lastUpdated = new Date().toISOString();

  // personalAvailabilityCache/{uid}
  const cacheRef  = db.collection(COLLECTIONS.PERSONAL_AVAILABILITY_CACHE).doc(uid);
  const cacheSnap = await cacheRef.get();

  if (cacheSnap.exists) {
    console.log(`  ↳ Availability cache already exists, skipping.`);
  } else {
    await cacheRef.set({
      userId: uid,
      lastUpdated,
      availableSlots: freeSlots,
      availableDatesUtc,
      ...filterFields,
      userStatus: status,
    });
    console.log(`  ↳ personalAvailabilityCache written (${freeSlots.length} slots across ${availableDatesUtc.length} days).`);
  }

  // coachAvailabilityByDate shards — always written via batch.set() (idempotent).
  // Firestore hard limit is 500 writes per batch; 490 gives safe headroom.
  const BATCH_LIMIT = 490;
  const entries = [...slotsByDate.entries()];
  let shardsWritten = 0;

  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + BATCH_LIMIT);
    for (const [dateISO, slots] of chunk) {
      const shardRef = db.collection(COLLECTIONS.COACH_AVAILABILITY_BY_DATE).doc(`${uid}_${dateISO}`);
      batch.set(shardRef, { coachUid: uid, dateISO, freeSlots: slots, lastUpdated, ...filterFields });
    }
    await batch.commit();
    shardsWritten += chunk.length;
  }

  console.log(`  ↳ coachAvailabilityByDate shards written (${shardsWritten} date shards).`);
}

// ── Main entry point ──────────────────────────────────────────────────────────

async function main() {
  const dataPath = path.join(__dirname, 'seed-users.json');

  if (!fs.existsSync(dataPath)) {
    console.error(`❌  Could not find seed data file at: ${dataPath}`);
    process.exit(1);
  }

  let users;
  try {
    users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    validateUsers(users);
  } catch (err) {
    console.error(`❌  Invalid seed-users.json: ${err.message}`);
    process.exit(1);
  }

  console.log('\n🌱  PCN — Local Emulator Seed Script');
  console.log(`    Firestore : ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`    Auth      : ${AUTH_EMULATOR_URL}`);
  console.log(`    Users     : ${users.length} defined in seed-users.json\n`);

  // Verify the Firestore emulator is reachable before iterating users.
  try {
    const pingRef = db.collection('_seed_check').doc('ping');
    await pingRef.set({ ts: FieldValue.serverTimestamp() });
    await pingRef.delete();
  } catch {
    console.error('❌  Cannot reach Firestore emulator. Is `make emulator` running in another terminal?');
    process.exit(1);
  }

  for (const user of users) {
    console.log(`👤  Seeding: ${user.firstName} ${user.lastName} <${user.email}>`);
    try {
      await seedUser(user);
      console.log(`✅  Done.\n`);
    } catch (err) {
      console.error(`❌  Failed to seed ${user.email}:`, err.message);
      process.exit(1);
    }
  }

  console.log('🎉  All seed users initialised. Log in via "Sign in with Google" — your accounts will appear in the picker.\n');
  process.exit(0);
}

main();
