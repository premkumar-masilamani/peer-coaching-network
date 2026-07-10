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
 * Each user is created with Google Sign-In as the only provider, so they
 * can log in via the emulator's "Sign in with Google" flow without a password.
 *
 * The script is fully idempotent: re-running it while the emulator is already
 * seeded will skip existing users gracefully (Auth + Firestore profile docs).
 * Availability shards are always (re)written using batch.set(), which is itself
 * idempotent, so interrupted runs do not leave partial data.
 */

'use strict';

// ── Point Admin SDK at the local emulators ────────────────────────────────────
// These must be set before the first require('firebase-admin/…') call.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const path = require('path');
const fs = require('fs');

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// ── Constants (mirrors src/config) ───────────────────────────────────────────
const PROJECT_ID = 'peer-coaching-network-dev';

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

// ── Firebase Admin initialisation ─────────────────────────────────────────────
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

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
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
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
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const y = parseInt(parts.find(p => p.type === 'year').value, 10);
  const m = parseInt(parts.find(p => p.type === 'month').value, 10);
  const d = parseInt(parts.find(p => p.type === 'day').value, 10);

  return new Date(y, m - 1, d);
}

// ── Default available days (mirrors DEFAULT_AVAILABLE_DAYS in slotsService.ts) ─
// Timestamps use a 1970-01-01 epoch base date at the given UTC time, identical
// to timeStringToTimestamp('9:00 AM') / timeStringToTimestamp('5:00 PM').
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
 *
 * @param {Date}     date         - Local calendar date (midnight local time)
 * @param {object}   availableDays - Shape matches DEFAULT_AVAILABLE_DAYS
 * @param {string[]} blockedDates  - 'YYYY-MM-DD' strings to skip
 * @param {string}   timezone      - IANA timezone string
 * @returns {string[]} Sorted UTC ISO slot strings
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

    // 30-minute increments — matches SLOT_DURATION_MINUTES and production logic
    for (let min = startTotalMinutes; min < endTotalMinutes; min += SLOT_DURATION_MINUTES) {
      const slotHour   = Math.floor(min / 60);
      const slotMinute = min % 60;
      const utcDate = getUtcForLocalDateTime(year, month, day, slotHour, slotMinute, timezone);
      slots.push(utcDate.toISOString());
    }
  }
  return slots;
}

/**
 * Compute availability for the booking horizon and return
 * { freeSlots, availableDatesUtc, slotsByDate }.
 *
 * Loop starts at BOOKING_START_OFFSET_DAYS (tomorrow) — matching the booking
 * UI which never shows today as a bookable date.
 */
function computeAvailability(timezone) {
  const localToday = getLocalDateInTimezone(new Date(), timezone);
  const allSlots = [];

  for (let i = BOOKING_START_OFFSET_DAYS; i <= BOOKING_HORIZON_DAYS; i++) {
    const currentDate = new Date(localToday);
    currentDate.setDate(localToday.getDate() + i);

    const daySlots = generateSlotsForDate(
      currentDate,
      DEFAULT_AVAILABLE_DAYS,
      [],   // no blocked dates for seed users
      timezone,
    );
    allSlots.push(...daySlots);
  }

  const freeSlots = [...new Set(allSlots)].sort();
  const availableDatesUtc = [...new Set(freeSlots.map(s => s.split('T')[0]))].sort();

  // Group by date for coachAvailabilityByDate shards
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
    // Validate timezone is parseable
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
    // Optional credential fields — can be added to seed-users.json to test
    // credentialed coaches. e.g. "icf_acc": true, "icf_pcc": true
    icf_acc = false,
    icf_pcc = false,
    icf_mcc = false,
    icf_actc = false,
  } = userData;

  const displayName    = `${firstName} ${lastName}`;
  const normalizedEmail = email.toLowerCase();

  // ── 1. Create Firebase Auth user (Google provider only) ───────────────────
  let uid;
  try {
    const existing = await auth.getUserByEmail(normalizedEmail);
    uid = existing.uid;
    console.log(`  ↳ Auth user already exists (uid: ${uid}), skipping auth creation.`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;

    const created = await auth.createUser({
      email: normalizedEmail,
      emailVerified: true,
      displayName,
      // Linking google.com as the provider causes the emulator's
      // "Sign in with Google" flow to surface this account for selection.
      providerData: [
        {
          uid: normalizedEmail,
          email: normalizedEmail,
          displayName,
          photoURL: null,
          providerId: 'google.com',
        },
      ],
    });
    uid = created.uid;
    console.log(`  ↳ Created Auth user (uid: ${uid})`);
  }

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
  // Only role=user AND status=active users appear in the discovery/booking flow.
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
      userStatus: status,   // use the variable, not a hardcoded string
    });
    console.log(`  ↳ personalAvailabilityCache written (${freeSlots.length} slots across ${availableDatesUtc.length} days).`);
  }

  // coachAvailabilityByDate shards — one document per day with free slots.
  // Always written via batch.set() which is inherently idempotent: re-running
  // after an interrupted previous run overwrites any partial state cleanly.
  // Firestore hard limit is 500 writes per batch; 490 gives safe headroom.
  const BATCH_LIMIT = 490;
  const entries = [...slotsByDate.entries()];
  let shardsWritten = 0;

  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + BATCH_LIMIT);
    for (const [dateISO, slots] of chunk) {
      const shardRef = db.collection(COLLECTIONS.COACH_AVAILABILITY_BY_DATE).doc(`${uid}_${dateISO}`);
      batch.set(shardRef, {
        coachUid: uid,
        dateISO,
        freeSlots: slots,
        lastUpdated,
        ...filterFields,
      });
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
  console.log(`    Auth      : ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`    Users     : ${users.length} defined in seed-users.json\n`);

  // Verify the emulator is reachable before iterating users.
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

  console.log('🎉  All seed users initialised. The app is ready — log in via "Sign in with Google".\n');
  process.exit(0);
}

main();
