import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminAuth, adminDb } from './helpers/adminClient';
import { signInUser, signOutUser } from './helpers/userClient';
import { setupGoogleCalendarMock } from './helpers/googleMock';
import { waitFor } from './helpers/waitFor';
import {
  setUserRoleAndStatus,
  updateOwnProfile,
  updateSchedule,
  getSchedule,
  getAllUsers,
  type UserProfile
} from '../../src/services/firebaseService';
import {
  scheduleMeeting,
  cancelBooking
} from '../../src/services/googleCalendar';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebaseService';
import { BOOKING_STATUS, BOOKING_ERROR, COLLECTIONS } from '../../src/config';

const userCount = parseInt(process.env.TEST_USER_COUNT || '3', 10);
const isPerfRun = process.env.PERF_P95_THRESHOLD_MS !== undefined || process.env.TEST_USER_COUNT === '100';

describe.runIf(!isPerfRun)('Use Case A - Functional Workflows against Firebase Emulators', () => {
  let adminUser: { uid: string; email: string };
  let pendingUser: { uid: string; email: string };
  let activeUser: { uid: string; email: string };

  beforeAll(async () => {
    setupGoogleCalendarMock();

    // Fetch the seeded users from the database using Admin SDK
    const snapshot = await adminDb.collection('users').get();
    const users = snapshot.docs.map(doc => doc.data() as UserProfile);

    const admins = users.filter(u => u.userRole === 'admin' && u.userStatus === 'active');
    const pendings = users.filter(u => u.userRole === 'user' && u.userStatus === 'inactive');
    const actives = users.filter(u => u.userRole === 'user' && u.userStatus === 'active');

    if (admins.length === 0 || pendings.length === 0 || actives.length === 0) {
      throw new Error(`Invalid seeded user composition: admins=${admins.length}, pendings=${pendings.length}, actives=${actives.length}`);
    }

    adminUser = { uid: admins[0].userId, email: admins[0].email };
    pendingUser = { uid: pendings[0].userId, email: pendings[0].email };
    activeUser = { uid: actives[0].userId, email: actives[0].email };
  });

  afterAll(async () => {
    await signOutUser();
  });

  it('1. Admin approves the pending user', async () => {
    await signInUser(adminUser.uid);
    await setUserRoleAndStatus(pendingUser.uid, 'user', 'active');

    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, pendingUser.uid));
    expect(userDoc.exists()).toBe(true);
    expect(userDoc.data()?.userStatus).toBe('active');
  });

  it('2. Active user updates their own profile', async () => {
    await signInUser(pendingUser.uid);

    const updates = {
      bio: 'New bio from integration tests',
      country: 'CA',
      gender: 'Male',
      timezone: 'America/Toronto'
    };

    await updateOwnProfile(pendingUser.uid, updates);

    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, pendingUser.uid));
    expect(userDoc.data()?.bio).toBe(updates.bio);
    expect(userDoc.data()?.country).toBe(updates.country);
    expect(userDoc.data()?.gender).toBe(updates.gender);
    expect(userDoc.data()?.timezone).toBe(updates.timezone);
  });

  it('3. Active user updates their availability template', async () => {
    await signInUser(activeUser.uid);

    const { timeStringToTimestamp } = await import('../../src/services/firebaseService');
    const startTs = timeStringToTimestamp('10:00 AM');
    const endTs = timeStringToTimestamp('3:00 PM');

    const customAvailableDays = {
      monday: { enabled: true, slots: [{ startTime: startTs, endTime: endTs }] },
      tuesday: { enabled: true, slots: [{ startTime: startTs, endTime: endTs }] },
      wednesday: { enabled: true, slots: [{ startTime: startTs, endTime: endTs }] },
      thursday: { enabled: true, slots: [{ startTime: startTs, endTime: endTs }] },
      friday: { enabled: true, slots: [{ startTime: startTs, endTime: endTs }] },
      saturday: { enabled: false, slots: [] },
      sunday: { enabled: false, slots: [] }
    };

    await updateSchedule(activeUser.uid, customAvailableDays, []);

    const schedule = await getSchedule(activeUser.uid);
    expect(schedule.availableDays.monday.enabled).toBe(true);
    expect(schedule.availableDays.monday.slots[0].startTime.seconds).toBe(startTs.seconds);
    expect(schedule.availableDays.monday.slots[0].endTime.seconds).toBe(endTs.seconds);
    expect(schedule.blockedDates).toHaveLength(0);
  });

  it('4. Active user adds a blocked date', async () => {
    await signInUser(activeUser.uid);
    const scheduleBefore = await getSchedule(activeUser.uid);
    const blockedDates = ['2030-01-15'];

    await updateSchedule(activeUser.uid, scheduleBefore.availableDays, blockedDates);

    const scheduleAfter = await getSchedule(activeUser.uid);
    expect(scheduleAfter.blockedDates).toContain('2030-01-15');
  });

  it('5. User A books a session with User B (active coach)', async () => {
    await signInUser(pendingUser.uid); // PendingUser is now active from test 1

    const startIso = '2030-02-20T10:00:00.000Z';
    const endIso = '2030-02-20T11:00:00.000Z';

    const booking = await scheduleMeeting(
      activeUser.uid,
      activeUser.email,
      'Active Coach',
      pendingUser.uid,
      'Active Client',
      startIso,
      endIso,
      'Integration test coaching session'
    );

    expect(booking.id).toBe(`${activeUser.uid}_${startIso}`);
    expect(booking.meetLink).toContain('meet.google.com');

    const bookingData = await waitFor(
      async () => {
        const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, booking.id));
        return snap.exists() && snap.data()?.status === BOOKING_STATUS.CONFIRMED
          ? snap.data()
          : undefined;
      },
      { description: 'booking to be persisted as CONFIRMED' }
    );
    expect(bookingData?.status).toBe(BOOKING_STATUS.CONFIRMED);
  });

  it('6. Booking collision is rejected', async () => {
    await signInUser(adminUser.uid);

    const startIso = '2030-02-20T10:00:00.000Z';
    const endIso = '2030-02-20T11:00:00.000Z';

    await expect(
      scheduleMeeting(
        activeUser.uid,
        activeUser.email,
        'Active Coach',
        adminUser.uid,
        'Another Client',
        startIso,
        endIso,
        'Collision test topic'
      )
    ).rejects.toThrow(BOOKING_ERROR.SLOT_TAKEN);
  });

  it('7. Pending user cannot book a session', async () => {
    const newPendingEmail = 'newpending@example.com';
    const userRecord = await adminAuth.createUser({
      email: newPendingEmail,
      password: 'password123',
    });
    
    const adminTimestamp = await import('firebase-admin/firestore');
    await adminDb.collection('users').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: newPendingEmail,
      firstName: 'New',
      lastName: 'Pending',
      userRole: 'user',
      userStatus: 'inactive',
      createdAt: adminTimestamp.Timestamp.now(),
      gender: 'other',
      country: 'US',
      bio: 'Pending user',
      timezone: 'UTC',
      theme: 'light'
    });

    await signInUser(userRecord.uid);

    const startIso = '2030-03-10T14:00:00.000Z';
    const endIso = '2030-03-10T15:00:00.000Z';

    await expect(
      scheduleMeeting(
        activeUser.uid,
        activeUser.email,
        'Active Coach',
        userRecord.uid,
        'Pending Client',
        startIso,
        endIso,
        'Pending booking topic'
      )
    ).rejects.toThrow();
  });

  it('8. User cancels a booking', async () => {
    await signInUser(pendingUser.uid);

    const startIso = '2030-02-20T10:00:00.000Z';
    const bookingId = `${activeUser.uid}_${startIso}`;

    await cancelBooking(bookingId);

    await waitFor(
      async () => {
        const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId));
        return snap.data()?.status === BOOKING_STATUS.CANCELLED;
      },
      { description: 'booking status to become CANCELLED' }
    );

    await waitFor(
      async () => {
        const snap = await getDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${pendingUser.uid}_${startIso}`));
        return !snap.exists();
      },
      { description: 'client booking cache lock to be released' }
    );
  });

  it('9. Admin reads all users', async () => {
    await signInUser(adminUser.uid);

    // One-shot query, retried until the seeded users are all readable (the
    // custom-token sign-in propagates asynchronously to the emulator).
    const usersList: UserProfile[] = await waitFor(
      async () => {
        const users = await getAllUsers();
        return users.length >= userCount ? users : undefined;
      },
      { description: `getAllUsers to return >= ${userCount} users` }
    );

    expect(usersList.length).toBeGreaterThanOrEqual(userCount);
    const adminInSnapshot = usersList.find(u => u.userId === adminUser.uid);
    expect(adminInSnapshot).toBeDefined();
  });

  it('10. Non-admin cannot read systemLogs', async () => {
    await signInUser(activeUser.uid);

    try {
      await getDocs(collection(db, 'systemLogs'));
      expect.fail('Should have failed with permission-denied');
    } catch (err: unknown) {
      const error = err as { code?: string };
      expect(error.code).toBe('permission-denied');
    }
  });

  it('11. personalAvailabilityCache write with large number of slots (>200) succeeds', async () => {
    await signInUser(activeUser.uid);

    const cacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, activeUser.uid);
    const largeSlots: string[] = [];
    for (let i = 0; i < 240; i++) {
      largeSlots.push(`2030-01-01T${String(Math.floor(i / 10)).padStart(2, '0')}:${String(i % 10).padStart(2, '0')}:00.000Z`);
    }

    const payload = {
      userId: activeUser.uid,
      lastUpdated: new Date().toISOString(),
      availableSlots: largeSlots,
      availableDatesUtc: ['2030-01-01'],
      gender: 'Male',
      country: 'US',
      icf_acc: false,
      icf_pcc: false,
      icf_mcc: false,
      icf_actc: false,
    };

    await expect(setDoc(cacheRef, payload)).resolves.toBeUndefined();
  });

  it('12. Booking visibility security rules enforcement', async () => {
    // 1. Create a booking between activeUser (coach) and pendingUser (client)
    await signInUser(pendingUser.uid);
    const startIso = '2030-07-20T10:00:00.000Z';
    const endIso = '2030-07-20T10:30:00.000Z';
    const booking = await scheduleMeeting(
      activeUser.uid,
      activeUser.email,
      'Active Coach',
      pendingUser.uid,
      'Active Client',
      startIso,
      endIso,
      'Visibility test coaching session'
    );

    const bookingId = booking.id;

    // 2. Client (pendingUser) can read the booking
    await signInUser(pendingUser.uid);
    const clientBookingDoc = await getDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId));
    expect(clientBookingDoc.exists()).toBe(true);

    // 3. Coach (activeUser) can read the booking
    await signInUser(activeUser.uid);
    const coachBookingDoc = await getDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId));
    expect(coachBookingDoc.exists()).toBe(true);

    // 4. A third-party user cannot read the booking
    const newPendingEmail = 'randomuser@example.com';
    const userRecord = await adminAuth.createUser({
      email: newPendingEmail,
      password: 'password123',
    });
    const adminTimestamp = await import('firebase-admin/firestore');
    await adminDb.collection('users').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: newPendingEmail,
      firstName: 'Random',
      lastName: 'User',
      userRole: 'user',
      userStatus: 'active',
      createdAt: adminTimestamp.Timestamp.now(),
      gender: 'other',
      country: 'US',
      bio: 'Random user',
      timezone: 'UTC',
      theme: 'light'
    });

    await signInUser(userRecord.uid);
    await expect(getDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId))).rejects.toThrow();

    // 5. Any signed-in user (including third-party) can read the busySlots document
    const busySlotSnap = await getDoc(doc(db, COLLECTIONS.BUSY_SLOTS, bookingId));
    expect(busySlotSnap.exists()).toBe(true);
    expect(busySlotSnap.data()?.coachUid).toBe(activeUser.uid);
    
    // Clean up
    await signInUser(pendingUser.uid);
    await cancelBooking(bookingId);
  });
});
