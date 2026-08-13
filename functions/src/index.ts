import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  generateTemplateSlots,
  type AvailableDays,
  BOOKING_STATUS,
  BOOKING_ERROR,
  BOOKING_HORIZON_DAYS,
} from "@pcn/shared";

admin.initializeApp(process.env.VITE_FIREBASE_PROJECT_ID ? { projectId: process.env.VITE_FIREBASE_PROJECT_ID } : undefined);
const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID;
const db = databaseId ? getFirestore(admin.app(), databaseId) : getFirestore();

// Google API helpers
const getGoogleApiBase = () => {
  if (process.env.VITE_USE_FIREBASE_EMULATOR === "true" || process.env.FUNCTIONS_EMULATOR === "true") {
    // Under local emulation, point to the mockGoogleCalendar endpoint running on port 5001.
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "peer-coaching-network";
    return `http://localhost:5001/${projectId}/us-central1/mockGoogleCalendar`;
  }
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
export const manageBooking = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const { action, bookingId, coachUid, startIso, endIso, topic, googleAccessToken, clientName, coachName, coachEmail } = data;
  const clientUid = context.auth.uid;
  const clientEmail = context.auth.token.email || "";

  if (action === "book") {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const availabilityRef = db.collection("availability").doc(coachUid);

    await db.runTransaction(async (t) => {
      const availSnap = await t.get(availabilityRef);
      if (!availSnap.exists) throw new functions.https.HttpsError("failed-precondition", "Coach availability not found.");

      const availData = availSnap.data()!;
      const slots: string[] = availData.availableSlotsUtc || [];
      if (!slots.includes(startIso)) {
        throw new functions.https.HttpsError("failed-precondition", "Slot is no longer available.");
      }

      // Check for client double-booking conflicts (overlapping sessions in either client or coach role)
      const clientBookingsQuery = db.collection("bookings")
        .where("clientUid", "==", clientUid)
        .where("status", "==", BOOKING_STATUS.CONFIRMED);

      const clientCoachBookingsQuery = db.collection("bookings")
        .where("coachUid", "==", clientUid)
        .where("status", "==", BOOKING_STATUS.CONFIRMED);

      const [clientBookingsSnap, clientCoachBookingsSnap] = await Promise.all([
        t.get(clientBookingsQuery),
        t.get(clientCoachBookingsQuery)
      ]);

      const reqStart = new Date(startIso).getTime();
      const reqEnd = new Date(endIso).getTime();

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
        bookingId,
        coachUid,
        clientUid,
        startIso,
        endIso,
        startTime: Timestamp.fromDate(new Date(startIso)),
        endTime: Timestamp.fromDate(new Date(endIso)),
        topic,
        status: BOOKING_STATUS.CONFIRMED,
        createdAt: FieldValue.serverTimestamp()
      });
    });

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
             requestId: bookingId,
             conferenceSolutionKey: { type: "hangoutsMeet" }
           }
         }
       };
       try {
         const gcalRes = await createGoogleEvent(googleAccessToken, eventPayload);
         eventId = gcalRes.id;
         meetLink = gcalRes.hangoutLink || "";
         await bookingRef.update({ googleEventId: eventId, googleMeetLink: meetLink });
       } catch (err) {
         console.error("Google Calendar Error:", err);
       }
    }

    return { success: true, bookingId, googleEventId: eventId, googleMeetLink: meetLink };

  } else if (action === "cancel") {
    const bookingRef = db.collection("bookings").doc(bookingId);
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
      }
    }

    await db.runTransaction(async (t) => {
      const availRef = db.collection("availability").doc(docData.coachUid);
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
          ? dayData.slots.map((slot) => ({
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
export const updateUserProfileAndSchedule = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const { profileData, availableDays, blockedDates, userId } = data;
  const callerUid = context.auth.uid;
  let uid = callerUid;

  if (userId && userId !== callerUid) {
    // Check if caller is admin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const isAdmin = callerDoc.exists && callerDoc.data()?.userRole === "admin";
    if (!isAdmin) {
      throw new functions.https.HttpsError("permission-denied", "Only admins can update other users' profiles.");
    }
    uid = userId;
  }

  const userRef = db.collection("users").doc(uid);
  const availableDaysRef = userRef.collection("schedule").doc("availableDays");
  const blockedDatesRef = userRef.collection("schedule").doc("blockedDates");
  const availRef = db.collection("availability").doc(uid);

  await db.runTransaction(async (t) => {
    const userDoc = await t.get(userRef);
    const existingProfile = userDoc.exists ? userDoc.data() : {};
    const mergedProfile = { ...existingProfile, ...(profileData || {}) };

    if (profileData) {
      t.set(userRef, { ...profileData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
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
export const syncMyCalendar = functions.https.onCall(async (data, context) => {
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

    const availRef = db.collection("availability").doc(uid);
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
 * Nightly cron job to replenish 30-day slot window, delete expired pending bookings, and delete subcollections.
 */
export const dailyHousekeeping = functions.pubsub.schedule("0 2 * * *").timeZone("UTC").onRun(async () => {
  const usersSnap = await db.collection("users").where("userStatus", "==", "active").get();
  const now = new Date();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data();
    const availableDaysRef = db.collection("users").doc(uid).collection("schedule").doc("availableDays");
    const blockedDatesRef = db.collection("users").doc(uid).collection("schedule").doc("blockedDates");
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

    await db.collection("availability").doc(uid).set({
      availableSlotsUtc: slots,
      lastUpdated: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  const pendingSnap = await db.collection("bookings")
    .where("status", "==", "PENDING")
    .where("createdAt", "<", Timestamp.fromDate(fifteenMinsAgo))
    .get();

  for (const doc of pendingSnap.docs) {
    const data = doc.data();
    await db.collection("availability").doc(data.coachUid).update({
      availableSlotsUtc: FieldValue.arrayUnion(data.startIso)
    });
    await doc.ref.delete();
  }

  // Clean up supportRequests > 7 days old
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const supportSnap = await db.collection("supportRequests")
    .where("status", "==", "closed")
    .get();

  for (const doc of supportSnap.docs) {
    const data = doc.data();
    let isOld = false;
    if (data.updatedAt) {
      if (typeof data.updatedAt === "string") {
         isOld = new Date(data.updatedAt) < sevenDaysAgo;
      } else if (data.updatedAt.toDate) {
         isOld = data.updatedAt.toDate() < sevenDaysAgo;
      }
    }

    if (isOld) {
      const messagesSnap = await doc.ref.collection("messages").get();
      const batch = db.batch();
      for (const msgDoc of messagesSnap.docs) {
        batch.delete(msgDoc.ref);
      }
      batch.delete(doc.ref);
      await batch.commit();
    }
  }

  console.log("Housekeeping task executed successfully");
  return null;
});

if (process.env.FUNCTIONS_EMULATOR === "true" || process.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  exports.mockGoogleCalendar = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    console.log(`Mock Google Calendar request received. Method: ${req.method}, Path: ${req.path}`);

    if (req.path.includes("/freeBusy")) {
      res.json({
        calendars: {
          primary: {
            busy: []
          }
        }
      });
      return;
    }

    if (req.method === "POST" && req.path.includes("/events")) {
      res.json({
        id: "mock-google-event-id",
        hangoutLink: "https://meet.google.com/mock-meet-link"
      });
      return;
    }

    if (req.method === "GET" && req.path.includes("/events")) {
      res.json({
        items: [
          {
            id: "mock-event-1",
            summary: "Project Review Meeting",
            description: "Sync with team",
            start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
            end: { dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() },
            hangoutLink: "https://meet.google.com/abc-defg-hij",
            attendees: [
              { email: "peer@example.com", displayName: "Peer Coach" }
            ]
          }
        ]
      });
      return;
    }

    if (req.method === "DELETE" && req.path.includes("/events/")) {
      res.status(204).send("");
      return;
    }

    res.status(404).json({ error: "Not found" });
  });
}
