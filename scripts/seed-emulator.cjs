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
process.env.VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
process.env.GCLOUD_PROJECT = 'peer-coaching-network-dev';

const path = require('path');
const fs   = require('fs');

const { updateUserProfileAndSchedule } = require('../functions/lib/index.js');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

// ── Constants (mirrors src/config) ───────────────────────────────────────────
const PROJECT_ID = 'peer-coaching-network-dev';

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID });
}

/** Auth emulator base URL. */
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

const COLLECTIONS = {
  USERS: 'users',
  SCHEDULE: 'schedule',
  AVAILABLE_DAYS: 'availableDays',
  BLOCKED_DATES: 'blockedDates',
};

/** Required fields every entry in seed-users.json must have. */
const REQUIRED_USER_FIELDS = [
  'firstName', 'lastName', 'email', 'role', 'status',
  'gender', 'country', 'timezone', 'bio',
];

// Get the firestore instance
const db = getFirestore(undefined, 'pcn-dev');

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

// ── Default available days (mirrors DEFAULT_AVAILABLE_DAYS in slotsService.ts) ─
function makeTimeTimestamp(utcHour, utcMinute) {
  return Timestamp.fromDate(new Date(Date.UTC(1970, 0, 1, utcHour, utcMinute, 0, 0)));
}

const DEFAULT_AVAILABLE_DAYS = {
  monday:    { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  tuesday:   { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  wednesday: { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  thursday:  { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  friday:    { enabled: true,  slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  saturday:  { enabled: false, slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
  sunday:    { enabled: false, slots: [{ startTime: makeTimeTimestamp(9, 0), endTime: makeTimeTimestamp(17, 0) }] },
};

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
    credentialDetails = '',
    icf_acc  = false,
    icf_pcc  = false,
    icf_mcc  = false,
    icf_actc = false,
  } = userData;

  const displayName     = `${firstName} ${lastName}`;
  const normalizedEmail = email.toLowerCase();

  // ── 1. Sign in via the emulator's Google provider API ─────────────────────
  const uid = await signInWithGoogleEmulator(normalizedEmail, displayName);
  console.log(`  ↳ Google Sign-In via emulator API (uid: ${uid})`);

  // ── 2. Ensure user profile document exists with a correct createdAt ───────
  const userRef  = db.collection(COLLECTIONS.USERS).doc(uid);
  const userSnap = await userRef.get();
  const createdAt = userSnap.exists ? (userSnap.data()?.createdAt || Timestamp.now()) : Timestamp.now();
  await userRef.set({ createdAt }, { merge: true });

  // ── 3. Call updateUserProfileAndSchedule Cloud Function logic ─────────────
  const data = {
    profileData: {
      userId: uid,
      email: normalizedEmail,
      firstName,
      lastName,
      displayName,
      photoURL: null,
      userRole: role,
      userStatus: status,
      gender,
      country,
      bio,
      timezone,
      credentialDetails,
      icf_acc,
      icf_pcc,
      icf_mcc,
      icf_actc,
      onboardingComplete: status === 'active',
    },
    availableDays: DEFAULT_AVAILABLE_DAYS,
    blockedDates: []
  };
  const context = { auth: { uid } };

  await updateUserProfileAndSchedule.run(data, context);
  console.log(`  ↳ Firestore profile, schedule and availability cache created via Cloud Function.`);
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
