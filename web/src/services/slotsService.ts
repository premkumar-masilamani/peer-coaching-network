import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebaseApp';
import { getUserProfile, getAvailability } from './firestoreRepository';
import { logger } from '../utils/logger';

export const recalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  try {
    const profile = await getUserProfile(uid);
    if (!profile || profile.userStatus !== 'active') {
      logger.info(`recalculateAvailableSlotsCache: Skipped GCF call for new/unapproved user ${uid} (status: ${profile?.userStatus})`);
      return;
    }
    const updateUserProfileAndSchedule = httpsCallable<unknown, void>(functions, 'updateUserProfileAndSchedule');
    await updateUserProfileAndSchedule({ userId: uid });
    logger.info(`Successfully triggered backend availability recalculation for user: ${uid}`);
  } catch (err) {
    logger.error(`Error calling backend recalculateAvailableSlotsCache for user ${uid}:`, err);
    throw err;
  }
};

export const lazyRecalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  const isOwner = auth?.currentUser?.uid === uid;
  if (!isOwner) {
    return;
  }

  try {
    const data = await getAvailability(uid);
    let shouldRecalc = false;

    if (data) {
      const lastUpdated = data.lastUpdated;

      const profile = await getUserProfile(uid);
      if (profile) {
        if (data.userStatus !== profile.userStatus) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Status changed from ${data.userStatus} to ${profile.userStatus}.`);
        }
        const hasSameAcc = !!data.icf_acc === !!profile.icf_acc;
        const hasSamePcc = !!data.icf_pcc === !!profile.icf_pcc;
        const hasSameMcc = !!data.icf_mcc === !!profile.icf_mcc;
        const hasSameActc = !!data.icf_actc === !!profile.icf_actc;
        if (!hasSameAcc || !hasSamePcc || !hasSameMcc || !hasSameActc) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Credentials changed.`);
        }
      }

      if (!shouldRecalc && lastUpdated) {
        const lastUpdatedMs = typeof lastUpdated.toDate === 'function' ? lastUpdated.toDate().getTime() : new Date(lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (ageMs > 24 * 60 * 60 * 1000) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} is older than 24 hours (${Math.round(ageMs / 3600000)}h).`);
        }
      } else if (!shouldRecalc) {
        shouldRecalc = true;
      }
    } else {
      shouldRecalc = true;
    }

    if (shouldRecalc) {
      await recalculateAvailableSlotsCache(uid);
    }
  } catch (err) {
    logger.error(`Error in lazyRecalculateAvailableSlotsCache for ${uid}:`, err);
  }
};

export const getUserAvailableSlots = async (uid: string): Promise<string[]> => {
  if (!db) return [];

  lazyRecalculateAvailableSlotsCache(uid);

  const cache = await getAvailability(uid);
  return cache ? (cache.availableSlotsUtc || []) : [];
};
