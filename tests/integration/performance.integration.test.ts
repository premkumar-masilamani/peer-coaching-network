import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminDb } from './helpers/adminClient';
import { signInUser, signOutUser } from './helpers/userClient';
import { setupGoogleCalendarMock } from './helpers/googleMock';
import {
  updateOwnProfile,
  type UserProfile
} from '../../src/services/firebaseService';
import {
  scheduleMeeting
} from '../../src/services/googleCalendar';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../src/services/firebaseService';
import { BOOKING_ERROR, COLLECTIONS } from '../../src/config';

const userCount = parseInt(process.env.TEST_USER_COUNT || '100', 10);
const thresholdP95 = parseInt(process.env.PERF_P95_THRESHOLD_MS || '3000', 10);
const isPerfRun = process.env.PERF_P95_THRESHOLD_MS !== undefined || process.env.TEST_USER_COUNT === '100';

describe.runIf(isPerfRun)('Use Case B - Performance & Concurrency tests against Firebase Emulators', () => {
  let adminUser: UserProfile;
  let coachUser: UserProfile;
  let clientUser: UserProfile;
  let allUsers: UserProfile[] = [];
  const latencies: number[] = [];

  async function measure<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      latencies.push(duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      latencies.push(duration);
      throw error;
    }
  }

  beforeAll(async () => {
    setupGoogleCalendarMock();

    // Fetch seeded users using Admin SDK
    const snapshot = await adminDb.collection('users').get();
    allUsers = snapshot.docs.map(doc => doc.data() as UserProfile);

    const admins = allUsers.filter(u => u.userRole === 'admin' && u.userStatus === 'active');
    const clients = allUsers.filter(u => u.userRole === 'user' && u.userStatus === 'active');

    if (admins.length === 0 || clients.length < 2) {
      throw new Error(`Insufficient seeded users for performance test: admins=${admins.length}, clients=${clients.length}`);
    }

    adminUser = admins[0];
    coachUser = clients[0]; // Coach is just an active user
    clientUser = clients[1]; // Client is another active user

    // Seed coachAvailabilityByDate so bookings pass the PCN-038 security rule
    const slotsToPublish = [
      '2030-05-15T09:00:00.000Z',
    ];
    for (let index = 0; index < 20; index++) {
      const hour = String(9 + (index % 8)).padStart(2, '0');
      const day = String(1 + Math.floor(index / 8)).padStart(2, '0');
      slotsToPublish.push(`2030-06-${day}T${hour}:00:00.000Z`);
    }

    const shards: Record<string, string[]> = {};
    for (const startIso of slotsToPublish) {
      const dateIso = startIso.split('T')[0];
      if (!shards[dateIso]) shards[dateIso] = [];
      shards[dateIso].push(startIso);
    }
    for (const [dateIso, freeSlots] of Object.entries(shards)) {
      await adminDb.collection('coachAvailabilityByDate').doc(`${coachUser.userId}_${dateIso}`).set({
        coachUid: coachUser.userId,
        dateISO: dateIso,
        freeSlots,
        lastUpdated: new Date().toISOString()
      });
    }
  });

  afterAll(async () => {
    await signOutUser();

    // Assert P95 latency gate across all test operations
    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];
      console.log(`[Perf] Total operations measured: ${latencies.length}`);
      console.log(`[Perf] Latency: Min=${latencies[0].toFixed(2)}ms, Max=${latencies[latencies.length - 1].toFixed(2)}ms, P95=${p95Latency.toFixed(2)}ms (Threshold=${thresholdP95}ms)`);
      
      expect(p95Latency).toBeLessThan(thresholdP95);
    }
  });

  it('1. Parallel profile updates', async () => {
    // Authenticate as Admin so we can write to all profiles concurrently
    await signInUser(adminUser.userId);

    const updatePromises = allUsers.map((user, index) => {
      const updates = {
        bio: `Updated profile bio ${index + 1} at ${new Date().toISOString()}`
      };
      return measure(() => updateOwnProfile(user.userId, updates));
    });

    const start = performance.now();
    await Promise.all(updatePromises);
    const totalTime = performance.now() - start;

    console.log(`[Perf] Parallel updates completed. Count=${updatePromises.length}, Total time=${totalTime.toFixed(2)}ms`);

    // Verify a random user doc was updated
    const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, randomUser.userId));
    expect(userDoc.data()?.bio).toContain('Updated profile bio');

    // Assert P95 time for profile updates is < 2000ms
    const profileUpdateLatencies = latencies.slice(-updatePromises.length).sort((a, b) => a - b);
    const p95Update = profileUpdateLatencies[Math.floor(profileUpdateLatencies.length * 0.95)];
    console.log(`[Perf] Profile updates P95 latency: ${p95Update.toFixed(2)}ms`);
    expect(p95Update).toBeLessThan(2000);
  });

  it('2. Concurrent bookings, no double-booking', async () => {
    // Authenticate as the client user
    await signInUser(clientUser.userId);

    const startIso = '2030-05-15T09:00:00.000Z';
    const endIso = '2030-05-15T10:00:00.000Z';

    const bookingAttempts = Math.floor(userCount / 2);
    console.log(`[Perf] Triggering ${bookingAttempts} concurrent booking attempts for the same slot...`);

    const bookingPromises = Array.from({ length: bookingAttempts }).map(() => {
      return measure(() => 
        scheduleMeeting(
          coachUser.userId,
          coachUser.email,
          `${coachUser.firstName} ${coachUser.lastName}`,
          clientUser.userId,
          `${clientUser.firstName} ${clientUser.lastName}`,
          startIso,
          endIso,
          'Concurrency test'
        )
      );
    });

    const results = await Promise.allSettled(bookingPromises);

    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`[Perf] Concurrent booking attempts result: Succeeded=${succeeded.length}, Failed=${failed.length}`);

    // Assert exactly 1 booking is committed
    expect(succeeded).toHaveLength(1);
    expect(failed.length).toBe(bookingAttempts - 1);

    // Verify all failures threw SLOT_TAKEN
    for (const fail of failed) {
      const reason = (fail as PromiseRejectedResult).reason;
      expect(reason.message).toBe(BOOKING_ERROR.SLOT_TAKEN);
    }

    // Assert no orphaned client booking cache documents
    // Should contain exactly 1 cache document for this client/time
    const cacheDoc = await getDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUser.userId}_${startIso}`));
    expect(cacheDoc.exists()).toBe(true);
  });

  it('3. Concurrent bookings, different slots', async () => {
    await signInUser(clientUser.userId);

    // Generate N non-overlapping slots
    // Let's create N slots sequentially on different days or hours
    const bookingPromises = Array.from({ length: Math.min(20, userCount) }).map((_, index) => {
      const hour = String(9 + (index % 8)).padStart(2, '0');
      const day = String(1 + Math.floor(index / 8)).padStart(2, '0');
      const startIso = `2030-06-${day}T${hour}:00:00.000Z`;
      const endIso = `2030-06-${day}T${String(10 + (index % 8)).padStart(2, '0')}:00:00.000Z`;

      return measure(() => 
        scheduleMeeting(
          coachUser.userId,
          coachUser.email,
          `${coachUser.firstName} ${coachUser.lastName}`,
          clientUser.userId,
          `${clientUser.firstName} ${clientUser.lastName}`,
          startIso,
          endIso,
          `Booking slot #${index + 1}`
        )
      );
    });

    const results = await Promise.allSettled(bookingPromises);
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`[Perf] Concurrent non-overlapping bookings result: Succeeded=${succeeded.length}, Failed=${failed.length}`);

    expect(succeeded.length).toBe(bookingPromises.length);
    expect(failed).toHaveLength(0);
  });
});
