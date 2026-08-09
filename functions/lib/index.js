"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyHousekeeping = exports.syncMyCalendar = exports.updateUserProfileAndSchedule = exports.manageBooking = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const slotGeneration_1 = require("./slotGeneration");
admin.initializeApp();
const db = admin.firestore();
// Google API helpers
const createGoogleEvent = async (token, eventPayload) => {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
    });
    if (!response.ok)
        throw new Error(`Google API Error: ${response.status}`);
    return response.json();
};
const deleteGoogleEvent = async (token, eventId) => {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok && response.status !== 404)
        throw new Error(`Google API Error: ${response.status}`);
};
const getGoogleFreeBusy = async (token, timeMin, timeMax) => {
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timeMin,
            timeMax,
            items: [{ id: 'primary' }]
        })
    });
    if (!response.ok)
        throw new Error(`Google API Error: ${response.status}`);
    return response.json();
};
/**
 * manageBooking
 * Single endpoint for booking and canceling sessions.
 */
exports.manageBooking = functions.https.onCall(async (data, context) => {
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
            if (!availSnap.exists)
                throw new functions.https.HttpsError("failed-precondition", "Coach availability not found.");
            const availData = availSnap.data();
            const slots = availData.availableSlotsUtc || [];
            if (!slots.includes(startIso)) {
                throw new functions.https.HttpsError("failed-precondition", "Slot is no longer available.");
            }
            t.update(availabilityRef, {
                availableSlotsUtc: admin.firestore.FieldValue.arrayRemove(startIso)
            });
            t.set(bookingRef, {
                bookingId,
                coachUid,
                clientUid,
                startIso,
                endIso,
                startTime: admin.firestore.Timestamp.fromDate(new Date(startIso)),
                endTime: admin.firestore.Timestamp.fromDate(new Date(endIso)),
                topic,
                status: "CONFIRMED",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
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
            }
            catch (err) {
                console.error("Google Calendar Error:", err);
            }
        }
        return { success: true, bookingId, googleEventId: eventId, googleMeetLink: meetLink };
    }
    else if (action === "cancel") {
        const bookingRef = db.collection("bookings").doc(bookingId);
        const doc = await bookingRef.get();
        if (!doc.exists)
            return { success: true };
        const docData = doc.data();
        if (docData.clientUid !== clientUid && docData.coachUid !== clientUid) {
            throw new functions.https.HttpsError("permission-denied", "Not authorized to cancel this booking.");
        }
        if (googleAccessToken && docData.googleEventId) {
            try {
                await deleteGoogleEvent(googleAccessToken, docData.googleEventId);
            }
            catch (err) {
                console.error("Google Calendar Error:", err);
            }
        }
        await db.runTransaction(async (t) => {
            const availRef = db.collection("availability").doc(docData.coachUid);
            t.update(bookingRef, { status: "CANCELLED", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            t.update(availRef, {
                availableSlotsUtc: admin.firestore.FieldValue.arrayUnion(docData.startIso)
            });
        });
        return { success: true };
    }
    throw new functions.https.HttpsError("invalid-argument", "Action must be book or cancel");
});
/**
 * updateUserProfileAndSchedule
 * Unified profile and schedule metadata synchronization.
 */
exports.updateUserProfileAndSchedule = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const { profileData, availableDays, blockedDates } = data;
    const uid = context.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const schedRef = userRef.collection("schedule").doc("default");
    const availRef = db.collection("availability").doc(uid);
    await db.runTransaction(async (t) => {
        t.set(userRef, { ...profileData, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        t.set(schedRef, { availableDays, blockedDates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        const now = new Date();
        const horizonDays = 30;
        const slots = (0, slotGeneration_1.generateTemplateSlots)({
            availableDays,
            blockedDates,
            timezone: profileData.timezone || "UTC",
            anchorDate: now,
            horizonDays
        });
        t.set(availRef, {
            coachUid: uid,
            availableSlotsUtc: slots,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            userStatus: profileData.userStatus,
            gender: profileData.gender || null,
            country: profileData.country || null,
            icf_acc: profileData.icf_acc || null,
            icf_pcc: profileData.icf_pcc || null,
            icf_mcc: profileData.icf_mcc || null,
            icf_actc: profileData.icf_actc || null,
        }, { merge: true });
    });
    return { success: true };
});
/**
 * syncMyCalendar
 * Called exclusively by the client upon login.
 */
exports.syncMyCalendar = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const { googleAccessToken } = data;
    if (!googleAccessToken)
        return { success: true };
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
            const availData = availDoc.data();
            let slots = availData.availableSlotsUtc || [];
            slots = slots.filter((slotIso) => {
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
            await availRef.update({ availableSlotsUtc: slots, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
        }
    }
    catch (err) {
        console.error("syncMyCalendar error:", err);
    }
    return { success: true };
});
/**
 * dailyHousekeeping
 * Nightly cron job to replenish 30-day slot window, delete expired pending bookings, and delete subcollections.
 */
exports.dailyHousekeeping = functions.pubsub.schedule("0 2 * * *").timeZone("UTC").onRun(async (context) => {
    const usersSnap = await db.collection("users").where("userStatus", "==", "active").get();
    const now = new Date();
    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();
        const schedRef = db.collection("users").doc(uid).collection("schedule").doc("default");
        const schedDoc = await schedRef.get();
        if (!schedDoc.exists)
            continue;
        const schedData = schedDoc.data();
        const slots = (0, slotGeneration_1.generateTemplateSlots)({
            availableDays: schedData.availableDays || {},
            blockedDates: schedData.blockedDates || [],
            timezone: userData.timezone || "UTC",
            anchorDate: now,
            horizonDays: 30
        });
        await db.collection("availability").doc(uid).set({
            availableSlotsUtc: slots,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const pendingSnap = await db.collection("bookings")
        .where("status", "==", "PENDING")
        .where("createdAt", "<", admin.firestore.Timestamp.fromDate(fifteenMinsAgo))
        .get();
    for (const doc of pendingSnap.docs) {
        const data = doc.data();
        await db.collection("availability").doc(data.coachUid).update({
            availableSlotsUtc: admin.firestore.FieldValue.arrayUnion(data.startIso)
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
            }
            else if (data.updatedAt.toDate) {
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
//# sourceMappingURL=index.js.map