import { adminAuth, adminDb } from './helpers/adminClient';
import { Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'peer-coaching-network-dev';
const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID || 'pcn-dev';

export async function wipeEmulatorData() {
  const firestoreUrl = `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/${databaseId}/documents`;
  const authUrl = `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`;

  const [fsRes, authRes] = await Promise.all([
    fetch(firestoreUrl, { method: 'DELETE' }),
    fetch(authUrl, { method: 'DELETE' }),
  ]);

  if (!fsRes.ok) {
    throw new Error(`Failed to clear Firestore: ${fsRes.statusText}`);
  }
  if (!authRes.ok) {
    throw new Error(`Failed to clear Auth: ${authRes.statusText}`);
  }
}

export async function seedDatabase() {
  const userCount = parseInt(process.env.TEST_USER_COUNT || '3', 10);
  const adminCount = parseInt(process.env.TEST_ADMIN_COUNT || '1', 10);
  const pendingCount = parseInt(process.env.TEST_PENDING_COUNT || '1', 10);
  const isPerfRun = process.env.PERF_P95_THRESHOLD_MS !== undefined || process.env.TEST_USER_COUNT === '100';

  console.log(`[Seed] Seeding database (isPerfRun=${isPerfRun}, userCount=${userCount})...`);

  // Wiping emulators first
  await wipeEmulatorData();

  // Create list of roles/statuses
  const usersToCreate: { role: 'user' | 'admin'; status: 'active' | 'inactive' }[] = [];

  if (isPerfRun) {
    // 1 guaranteed admin
    usersToCreate.push({ role: 'admin', status: 'active' });
    // all remaining users are active users (no pending users)
    for (let i = 1; i < userCount; i++) {
      usersToCreate.push({ role: 'user', status: 'active' });
    }
  } else {
    // Exactly adminCount admins
    for (let i = 0; i < adminCount; i++) {
      usersToCreate.push({ role: 'admin', status: 'active' });
    }
    // Exactly pendingCount pending users
    for (let i = 0; i < pendingCount; i++) {
      usersToCreate.push({ role: 'user', status: 'inactive' });
    }
    // All remaining users are active users
    const remaining = userCount - adminCount - pendingCount;
    for (let i = 0; i < remaining; i++) {
      usersToCreate.push({ role: 'user', status: 'active' });
    }
  }

  // Create users in Auth and Firestore
  const seededUsers: { uid: string; email: string; role: string; status: string }[] = [];

  for (let i = 0; i < usersToCreate.length; i++) {
    const { role, status } = usersToCreate[i];
    const email = `testuser${i + 1}@example.com`.toLowerCase();
    
    // 1. Create in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password: 'password123',
      displayName: `Test User ${i + 1}`,
    });

    const uid = userRecord.uid;

    // 2. Create in Firestore
    const userProfile = {
      userId: uid,
      email,
      firstName: 'Test',
      lastName: `User ${i + 1}`,
      displayName: `Test User ${i + 1}`,
      photoURL: null,
      gender: 'other',
      country: 'US',
      bio: `Bio for Test User ${i + 1}`,
      timezone: 'UTC',
      userRole: role,
      userStatus: status,
      theme: 'light',
      createdAt: Timestamp.now(),
    };

    await adminDb.collection('users').doc(uid).set(userProfile);
    seededUsers.push({ uid, email, role, status });
  }

  console.log(`[Seed] Successfully seeded ${seededUsers.length} users.`);
  return seededUsers;
}
