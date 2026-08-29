import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  generateTemplateSlots,
  type AvailableDays,
  BOOKING_STATUS,
  BOOKING_ERROR,
  BOOKING_HORIZON_DAYS,
  INPUT_LIMITS,
  COLLECTIONS,
  SYSTEM_LOGS_TTL_DAYS,
  ALLOWED_BOOKING_DURATIONS_MIN,
  MAX_SLOTS_PER_DAY,
  CRON_SCHEDULES,
  LOG_SEVERITY,
  type LogSeverity,
} from "@pcn/shared";

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID;
const region = process.env.VITE_FIREBASE_REGION;

if (!databaseId) {
  throw new Error(
    "Missing required environment variable: VITE_FIRESTORE_DATABASE_ID. " +
    "Please specify the Firestore database name in your environment configuration."
  );
}

if (!region) {
  throw new Error(
    "Missing required environment variable: VITE_FIREBASE_REGION. " +
    "Please specify the Firebase Functions region in your environment configuration."
  );
}

admin.initializeApp(projectId ? { projectId } : undefined);
const db = getFirestore(admin.app(), databaseId);
const regionFunctions = functions.region(region);

// Helper for SystemLogs
const logSystemEvent = async (
  type: LogSeverity,
  event: string,
  details: Record<string, unknown> = {},
  userId?: string | null
) => {
  try {
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + SYSTEM_LOGS_TTL_DAYS);
    const resolvedUserId = userId ?? (details.userId as string) ?? (details.coachUid as string) ?? null;
    const resolvedErrorMessage = (details.error as string) ?? (details.errorMessage as string) ?? null;

    await db.collection(COLLECTIONS.SYSTEM_LOGS).add({
      type,
      event,
      userId: resolvedUserId,
      userEmail: (details.userEmail as string) ?? null,
      errorMessage: resolvedErrorMessage,
      details,
      timestamp: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromDate(expireAt)
    });
  } catch (e) {
    console.error("Failed to write to systemLogs", e);
  }
};


// Google API helpers
const getGoogleApiBase = () => {
  return "https://www.googleapis.com";
};

const createGoogleEvent = async (token: string, eventPayload: unknown) => {
  const apiBase = getGoogleApiBase();
  const response = await fetch(`${apiBase}/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventPayload)
  });
  if (!response.ok) throw new Error(`Google API Error: ${response.status}`);
  return response.json();
};

const deleteGoogleEvent = async (token: string, eventId: string) => {
  const apiBase = getGoogleApiBase();
  const response = await fetch(`${apiBase}/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.status !== 404) throw new Error(`Google API Error: ${response.status}`);
};

const getGoogleFreeBusy = async (token: string, timeMin: string, timeMax: string) => {
  const apiBase = getGoogleApiBase();
  const response = await fetch(`${apiBase}/calendar/v3/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: 'primary' }]
    })
  });
  if (!response.ok) throw new Error(`Google API Error: ${response.status}`);
  return response.json();
};

/**
 * manageBooking
 * Single endpoint for booking and canceling sessions.
 */
export const manageBooking = regionFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const { action, bookingId, coachUid, startIso, endIso, topic, googleAccessToken, clientName, coachName, coachEmail } = data;
  const clientUid = context.auth.uid;
  const clientEmail = context.auth.token.email || "";

  if (action === "book") {
    const generatedBookingId = `${coachUid}_${startIso}`;
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(generatedBookingId);
    const availabilityRef = db.collection(COLLECTIONS.AVAILABILITY).doc(coachUid);

    const reqStart = new Date(startIso).getTime();
    const reqEnd = new Date(endIso).getTime();
    
    if (isNaN(reqStart) || isNaN(reqEnd)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid date format for startIso or endIso.");
    }
    const diffMins = (reqEnd - reqStart) / 60000;
    if (!ALLOWED_BOOKING_DURATIONS_MIN.includes(diffMins as typeof ALLOWED_BOOKING_DURATIONS_MIN[number])) {
      throw new functions.https.HttpsError("invalid-argument", "Booking duration must be exactly 30 or 60 minutes.");
    }
    if (topic && topic.length > INPUT_LIMITS.COACHING_TOPIC) {
      throw new functions.https.HttpsError("invalid-argument", "Topic exceeds maximum length.");
    }

    let meetLink = "";
    let eventId = "";

    if (googleAccessToken) {
       const eventPayload = {
         summary: `${coachName} / ${clientName} - Peer Coaching Session`,
         description: `Topic: ${topic}`,
         start: { dateTime: startIso },
         end: { dateTime: endIso },
         attendees: [{ email: coachEmail }, { email: clientEmail }],
         conferenceData: {
           createRequest: {
             requestId: generatedBookingId,
             conferenceSolutionKey: { type: "hangoutsMeet" }
           }
         }
       };
       try {
         const gcalRes = await createGoogleEvent(googleAccessToken, eventPayload);
         eventId = gcalRes.id;
         meetLink = gcalRes.hangoutLink || "";
        } catch (err) {
          console.error("Google Calendar Error:", err);
          await logSystemEvent(LOG_SEVERITY.ERROR, "GOOGLE_CALENDAR_CREATE_FAILED", { userId: clientUid, error: String(err) }, clientUid);
          throw new functions.https.HttpsError("internal", "Failed to create Google Calendar event. Booking aborted.");
        }
    }

    try {
      await db.runTransaction(async (t) => {
        const bookingSnap = await t.get(bookingRef);
        if (bookingSnap.exists && bookingSnap.data()?.status === BOOKING_STATUS.CONFIRMED) {
          throw new functions.https.HttpsError("already-exists", "This slot is already booked.");
        }

        const availSnap = await t.get(availabilityRef);
        if (!availSnap.exists) throw new functions.https.HttpsError("failed-precondition", "Coach availability not found.");

        const availData = availSnap.data()!;
        const slots: string[] = availData.availableSlotsUtc || [];
        if (!slots.includes(startIso)) {
          throw new functions.https.HttpsError("failed-precondition", "Slot is no longer available.");
        }

        // Check for client double-booking conflicts (overlapping sessions in either client or coach role)
        const clientBookingsQuery = db.collection(COLLECTIONS.BOOKINGS)
          .where("clientUid", "==", clientUid)
          .where("status", "==", BOOKING_STATUS.CONFIRMED);

        const clientCoachBookingsQuery = db.collection(COLLECTIONS.BOOKINGS)
          .where("coachUid", "==", clientUid)
          .where("status", "==", BOOKING_STATUS.CONFIRMED);

        const [clientBookingsSnap, clientCoachBookingsSnap] = await Promise.all([
          t.get(clientBookingsQuery),
          t.get(clientCoachBookingsQuery)
        ]);

        for (const docSnap of clientBookingsSnap.docs) {
          const docData = docSnap.data();
          const bStart = docData.startTime.toDate().getTime();
          const bEnd = docData.endTime.toDate().getTime();
          if (reqStart < bEnd && reqEnd > bStart) {
            throw new functions.https.HttpsError("failed-precondition", BOOKING_ERROR.BOOKED_AS_CLIENT);
          }
        }

        for (const docSnap of clientCoachBookingsSnap.docs) {
          const docData = docSnap.data();
          const bStart = docData.startTime.toDate().getTime();
          const bEnd = docData.endTime.toDate().getTime();
          if (reqStart < bEnd && reqEnd > bStart) {
            throw new functions.https.HttpsError("failed-precondition", BOOKING_ERROR.BOOKED_AS_COACH);
          }
        }

        t.update(availabilityRef, {
          availableSlotsUtc: FieldValue.arrayRemove(startIso)
        });

        t.set(bookingRef, {
          bookingId: generatedBookingId,
          coachUid,
          clientUid,
          startIso,
          endIso,
          startTime: Timestamp.fromDate(new Date(startIso)),
          endTime: Timestamp.fromDate(new Date(endIso)),
          topic: topic || "",
          status: BOOKING_STATUS.CONFIRMED,
          createdAt: FieldValue.serverTimestamp(),
          googleEventId: eventId,
          googleMeetLink: meetLink
        });
      });
    } catch (e) {
       // Rollback Google Calendar Event if transaction fails
       if (googleAccessToken && eventId) {
          try {
            await deleteGoogleEvent(googleAccessToken, eventId);
          } catch (delErr) {
            console.error("Failed to rollback Google Calendar Event:", delErr);
            await logSystemEvent(LOG_SEVERITY.ERROR, "GOOGLE_CALENDAR_ROLLBACK_FAILED", { userId: clientUid, eventId, error: String(delErr) }, clientUid);
          }
       }
       throw e;
    }

    return { success: true, bookingId: generatedBookingId, googleEventId: eventId, googleMeetLink: meetLink };

  } else if (action === "cancel") {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const doc = await bookingRef.get();
    if (!doc.exists) return { success: true };
    const docData = doc.data()!;

    if (docData.clientUid !== clientUid && docData.coachUid !== clientUid) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized to cancel this booking.");
    }

    if (googleAccessToken && docData.googleEventId) {
      try {
        await deleteGoogleEvent(googleAccessToken, docData.googleEventId);
      } catch (err) {
        console.error("Google Calendar Error:", err);
        await logSystemEvent(LOG_SEVERITY.WARN, "GOOGLE_CALENDAR_DELETE_FAILED", { userId: clientUid, eventId: docData.googleEventId, error: String(err) }, clientUid);
      }
    }

    await db.runTransaction(async (t) => {
      const availRef = db.collection(COLLECTIONS.AVAILABILITY).doc(docData.coachUid);
      t.update(bookingRef, { status: BOOKING_STATUS.CANCELLED, updatedAt: FieldValue.serverTimestamp() });
      t.update(availRef, {
        availableSlotsUtc: FieldValue.arrayUnion(docData.startIso)
      });
    });

    return { success: true };
  }

  throw new functions.https.HttpsError("invalid-argument", "Action must be book or cancel");
});

interface RawTimestamp {
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
  toDate?: () => Date;
}

interface RawSlot {
  startTime?: RawTimestamp;
  endTime?: RawTimestamp;
}

interface RawDayAvailability {
  enabled?: boolean;
  slots?: RawSlot[];
}

interface RawAvailableDays {
  monday?: RawDayAvailability;
  tuesday?: RawDayAvailability;
  wednesday?: RawDayAvailability;
  thursday?: RawDayAvailability;
  friday?: RawDayAvailability;
  saturday?: RawDayAvailability;
  sunday?: RawDayAvailability;
}

function parseTimestamp(val: Timestamp | RawTimestamp | undefined | null): Timestamp {
  if (!val) {
    return Timestamp.now();
  }
  if (val instanceof Timestamp) {
    return val;
  }
  if (typeof val === "object") {
    if (typeof val.seconds === "number" && typeof val.nanoseconds === "number") {
      return new Timestamp(val.seconds, val.nanoseconds);
    }
    if (typeof val._seconds === "number" && typeof val._nanoseconds === "number") {
      return new Timestamp(val._seconds, val._nanoseconds);
    }
    if (typeof val.toDate === "function") {
      return Timestamp.fromDate(val.toDate());
    }
  }
  return Timestamp.now();
}

function parseAvailableDays(availableDays: RawAvailableDays | undefined | null): AvailableDays {
  const result: AvailableDays = {
    monday: { enabled: false, slots: [] },
    tuesday: { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday: { enabled: false, slots: [] },
    friday: { enabled: false, slots: [] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
  };
  const days: (keyof AvailableDays)[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of days) {
    const dayData = availableDays && availableDays[day];
    if (dayData) {
      result[day] = {
        enabled: !!dayData.enabled,
        slots: Array.isArray(dayData.slots)
          ? dayData.slots.slice(0, MAX_SLOTS_PER_DAY).map((slot) => ({
              startTime: parseTimestamp(slot.startTime),
              endTime: parseTimestamp(slot.endTime)
            }))
          : []
      };
    }
  }
  return result;
}

/**
 * updateUserProfileAndSchedule
 * Unified profile and schedule metadata synchronization.
 */
export const updateUserProfileAndSchedule = regionFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const { profileData, availableDays, blockedDates, userId } = data;
  const callerUid = context.auth.uid;
  let uid = callerUid;
  let callerIsAdmin = false;

  if (userId && userId !== callerUid) {
    // Check if caller is admin
    const callerDoc = await db.collection(COLLECTIONS.USERS).doc(callerUid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data()?.userRole === "admin";
    if (!callerIsAdmin) {
      throw new functions.https.HttpsError("permission-denied", "Only admins can update other users' profiles.");
    }
    uid = userId;
  }

  // Privileged fields (role, approval status, verified ICF credentials) are
  // admin-controlled. A self-update must never be able to set them, or a user
  // could escalate to admin by passing them in profileData. Strip them here for
  // any non-admin caller; admins editing another user (callerIsAdmin) keep them.
  let effectiveProfileData = profileData;
  if (profileData && !callerIsAdmin) {
    effectiveProfileData = { ...profileData };
    delete effectiveProfileData.userRole;
    delete effectiveProfileData.userStatus;
    delete effectiveProfileData.icf_acc;
    delete effectiveProfileData.icf_pcc;
    delete effectiveProfileData.icf_mcc;
    delete effectiveProfileData.icf_actc;
  }

  if (effectiveProfileData) {
    if (effectiveProfileData.bio && effectiveProfileData.bio.length > INPUT_LIMITS.BIO) {
      throw new functions.https.HttpsError("invalid-argument", "Bio exceeds maximum length.");
    }
    if (effectiveProfileData.credentialDetails && effectiveProfileData.credentialDetails.length > INPUT_LIMITS.CREDENTIAL_DETAILS) {
      throw new functions.https.HttpsError("invalid-argument", "Credential Details exceeds maximum length.");
    }
    if (effectiveProfileData.firstName && effectiveProfileData.firstName.length > INPUT_LIMITS.NAME) effectiveProfileData.firstName = effectiveProfileData.firstName.substring(0, INPUT_LIMITS.NAME);
    if (effectiveProfileData.lastName && effectiveProfileData.lastName.length > INPUT_LIMITS.NAME) effectiveProfileData.lastName = effectiveProfileData.lastName.substring(0, INPUT_LIMITS.NAME);
    if (effectiveProfileData.displayName && effectiveProfileData.displayName.length > INPUT_LIMITS.NAME) effectiveProfileData.displayName = effectiveProfileData.displayName.substring(0, INPUT_LIMITS.NAME);
  }


  const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
  const availableDaysRef = userRef.collection(COLLECTIONS.USERS_SCHEDULE).doc(COLLECTIONS.USERS_SCHEDULE_AVAILABLE_DAYS);
  const blockedDatesRef = userRef.collection(COLLECTIONS.USERS_SCHEDULE).doc(COLLECTIONS.USERS_SCHEDULE_BLOCKED_DATES);
  const availRef = db.collection(COLLECTIONS.AVAILABILITY).doc(uid);

  await db.runTransaction(async (t) => {
    const userDoc = await t.get(userRef);
    const existingProfile = userDoc.exists ? userDoc.data() : {};
    let newDocData = {};
    if (!userDoc.exists) {
      newDocData = {
        userRole: 'user',
        userStatus: 'inactive',
        createdAt: FieldValue.serverTimestamp()
      };
    }

    const mergedProfile = { ...existingProfile, ...newDocData, ...(effectiveProfileData || {}) };

    if (effectiveProfileData || !userDoc.exists) {
      t.set(userRef, { ...newDocData, ...(effectiveProfileData || {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    let effectiveAvailableDays: AvailableDays;
    let effectiveBlockedDates: string[];

    if (!availableDays) {
      const [daysSnap, datesSnap] = await Promise.all([
        t.get(availableDaysRef),
        t.get(blockedDatesRef)
      ]);
      effectiveAvailableDays = daysSnap.exists ? parseAvailableDays(daysSnap.data()) : parseAvailableDays({});
      effectiveBlockedDates = datesSnap.exists ? (datesSnap.data()!.blockedDates || []) : [];
    } else {
      effectiveAvailableDays = parseAvailableDays(availableDays);
      effectiveBlockedDates = blockedDates || [];
      t.set(availableDaysRef, effectiveAvailableDays);
      t.set(blockedDatesRef, { blockedDates: effectiveBlockedDates });
    }

    const now = new Date();
    const horizonDays = BOOKING_HORIZON_DAYS + 1;

    const slots = generateTemplateSlots({
      availableDays: effectiveAvailableDays,
      blockedDates: effectiveBlockedDates,
      timezone: mergedProfile.timezone || "UTC",
      anchorDate: now,
      horizonDays
    });

    t.set(availRef, {
      coachUid: uid,
      availableSlotsUtc: slots,
      lastUpdated: FieldValue.serverTimestamp(),
      userStatus: mergedProfile.userStatus || null,
      gender: mergedProfile.gender || null,
      country: mergedProfile.country || null,
      icf_acc: mergedProfile.icf_acc || null,
      icf_pcc: mergedProfile.icf_pcc || null,
      icf_mcc: mergedProfile.icf_mcc || null,
      icf_actc: mergedProfile.icf_actc || null,
    }, { merge: true });
  });

  return { success: true };
});

/**
 * syncMyCalendar
 * Called exclusively by the client upon login.
 */
export const syncMyCalendar = regionFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const { googleAccessToken } = data;
  if (!googleAccessToken) return { success: true };

  const uid = context.auth.uid;
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMaxDate = new Date(now);
  timeMaxDate.setDate(now.getDate() + 30);
  const timeMax = timeMaxDate.toISOString();

  try {
    const freeBusy = await getGoogleFreeBusy(googleAccessToken, timeMin, timeMax);
    const busyTimes = freeBusy.calendars?.primary?.busy || [];

    const availRef = db.collection(COLLECTIONS.AVAILABILITY).doc(uid);
    const availDoc = await availRef.get();
    if (availDoc.exists) {
      const availData = availDoc.data()!;
      let slots = availData.availableSlotsUtc || [];
      slots = slots.filter((slotIso: string) => {
        const slotTime = new Date(slotIso).getTime();
        for (const busy of busyTimes) {
          const bStart = new Date(busy.start).getTime();
          const bEnd = new Date(busy.end).getTime();
          if (slotTime >= bStart && slotTime < bEnd) {
            return false;
          }
        }
        return true;
      });
      await availRef.update({ availableSlotsUtc: slots, lastUpdated: FieldValue.serverTimestamp() });
    }
  } catch (err) {
    console.error("syncMyCalendar error:", err);
  }

  return { success: true };
});

/**
 * dailyHousekeeping
 * Nightly cron job to replenish 30-day slot window.
 * Support request and SystemLog cleanups are handled via Firestore TTL.
 */
export const dailyHousekeeping = regionFunctions.pubsub.schedule(CRON_SCHEDULES.DAILY_HOUSEKEEPING).timeZone("UTC").onRun(async () => {
  const now = new Date();
  
  let lastVisible = null;
  let hasMore = true;

  while (hasMore) {
    try {
      let query = db.collection(COLLECTIONS.USERS).where("userStatus", "==", "active").limit(100);
      if (lastVisible) {
        query = query.startAfter(lastVisible);
      }
      const usersSnap = await query.get();
      
      if (usersSnap.empty) {
        hasMore = false;
        break;
      }
      
      lastVisible = usersSnap.docs[usersSnap.docs.length - 1];

      for (const userDoc of usersSnap.docs) {
        try {
          const uid = userDoc.id;
          const userData = userDoc.data();
          const availableDaysRef = db.collection(COLLECTIONS.USERS).doc(uid).collection(COLLECTIONS.USERS_SCHEDULE).doc(COLLECTIONS.USERS_SCHEDULE_AVAILABLE_DAYS);
          const blockedDatesRef = db.collection(COLLECTIONS.USERS).doc(uid).collection(COLLECTIONS.USERS_SCHEDULE).doc(COLLECTIONS.USERS_SCHEDULE_BLOCKED_DATES);
          const [daysDoc, datesDoc] = await Promise.all([availableDaysRef.get(), blockedDatesRef.get()]);

          if (!daysDoc.exists) continue;

          const daysData = daysDoc.data()!;
          const datesData = datesDoc.exists ? datesDoc.data()! : {};

          const slots = generateTemplateSlots({
            availableDays: parseAvailableDays(daysData),
            blockedDates: datesData.blockedDates || [],
            timezone: userData.timezone || "UTC",
            anchorDate: now,
            horizonDays: BOOKING_HORIZON_DAYS + 1
          });

          await db.collection(COLLECTIONS.AVAILABILITY).doc(uid).set({
            availableSlotsUtc: slots,
            lastUpdated: FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (coachErr) {
          console.error(`Error processing coach ${userDoc.id} in dailyHousekeeping:`, coachErr);
          await logSystemEvent(LOG_SEVERITY.ERROR, "HOUSEKEEPING_COACH_FAILED", { coachUid: userDoc.id, error: String(coachErr) }, userDoc.id);
        }
      }
    } catch (err) {
      console.error("Housekeeping pagination error:", err);
      await logSystemEvent(LOG_SEVERITY.ERROR, "HOUSEKEEPING_BATCH_FAILED", { error: String(err) });
      hasMore = false;
    }
  }

  console.log("Housekeeping task executed successfully");
  return null;
});

