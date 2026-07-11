import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { seedDatabase } from './seed';

let emulatorProcess: ChildProcess | null = null;
let spawnedEmulator = false;

// Load firestore.rules into the emulator's target database — the one the
// integration client connects to (VITE_FIRESTORE_DATABASE_ID='pcn-dev').
//
// This is REQUIRED even when we spawn our own emulator, and critical when we
// reuse one: a developer's `make emulator` starts with the default firebase.json,
// which binds rules to the NAMED databases (pcn-dev/pcn-prod).
// Pushing the rules here makes enforcement deterministic regardless of how
// the emulator was started.
async function loadFirestoreRules() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'peer-coaching-network-dev';
  const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID || 'pcn-dev';
  const rulesPath = fileURLToPath(new URL('../../firestore.rules', import.meta.url));
  const content = readFileSync(rulesPath, 'utf8');

  const url = `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/${databaseId}:securityRules`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  });

  if (!res.ok) {
    throw new Error(`[GlobalSetup] Failed to load Firestore rules into emulator: ${res.status} ${await res.text()}`);
  }
  console.log(`[GlobalSetup] Loaded firestore.rules into the emulator ${databaseId} database.`);
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(200);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Connected, so port is occupied / open
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

export async function setup() {
  console.log('[GlobalSetup] Checking if Firebase Emulators are already running...');
  const authPortOccupied = await isPortOpen(9099);
  const firestorePortOccupied = await isPortOpen(8080);

  if (authPortOccupied && firestorePortOccupied) {
    console.log('[GlobalSetup] Firebase Emulators are already running on ports 9099 and 8080. Reusing existing emulator.');
  } else {
    console.log('[GlobalSetup] Starting Firebase Emulators...');
    emulatorProcess = spawn(
      './node_modules/.bin/firebase',
      ['emulators:start', '--project=peer-coaching-network-dev', '--only', 'auth,firestore', '--config', 'firebase.emulator.json'],
      {
        stdio: 'inherit',
        shell: true,
      }
    );
    spawnedEmulator = true;

    // Wait for Auth and Firestore emulators to be ready (up to 30 seconds)
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const authReady = await isPortOpen(9099);
      const firestoreReady = await isPortOpen(8080);
      if (authReady && firestoreReady) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!ready) {
      throw new Error('[GlobalSetup] Firebase Emulators failed to start or ports 9099/8080 are not open after 30s.');
    }
    console.log('[GlobalSetup] Firebase Emulators started successfully.');
  }

  // Ensure the configured database enforces our security rules before any test
  // runs, regardless of whether we spawned the emulator or reused an existing
  // one started with a different config.
  await loadFirestoreRules();

  // Seed the database initially
  await seedDatabase();
}

export async function teardown() {
  if (spawnedEmulator && emulatorProcess) {
    console.log('[GlobalSetup] Stopping Firebase Emulators...');
    // Kill child process. In Windows/Mac shells, we might need to send SIGTERM or SIGKILL, or kill the process tree.
    // Calling .kill() is the standard Node.js way.
    emulatorProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1000));
  }
}
