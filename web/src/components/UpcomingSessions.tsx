import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import './UpcomingSessions.css';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFocusRefresh } from '../hooks/useFocusRefresh';

import { subscribeAvailableCoachesForDay, getUserBookings, getProfiles } from '../services/firebaseService';
import { hasExpiredGoogleToken, getGoogleToken } from '../services/googleToken';
import type { UserProfile } from '../services/firebaseService';
import { 
  getUpcomingEvents,
  cancelBooking
} from '../services/googleCalendar';
import type { CalendarEvent } from '../services/googleCalendar';
import type { DocumentData } from 'firebase/firestore';
import { ScheduleModal } from './modals/ScheduleModal';
import { CancelModal } from './modals/CancelModal';
import { SessionDetailsModal } from './modals/SessionDetailsModal';
import { SlotPicker } from './SlotPicker';

import { 
  Filter, 
  MapPin, 
  Award, 
  User as UserIcon, 
  X
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getLocalDateInTimezone, getTimezoneCode, getUtcForLocalDateTime } from '../utils/timezoneHelpers';
import { getParticipantNames, getBookingTopic } from '../utils/calendarHelpers';
import { BOOKING_START_OFFSET_DAYS, BOOKING_HORIZON_DAYS, BOOKING_STATUS, GENDER_OPTIONS, type Qualification, QUALIFICATION_OPTIONS, EVENT_TYPE, BOOKING_ERROR } from '../config';


export const UpcomingSessions: React.FC = () => {
  const { user: currentUser, profile, login } = useAuth();
  const { showToast } = useToast();
  
  // List states
  const [dayAvailability, setDayAvailability] = useState<Record<string, UserProfile[]>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [isFetchingDay, setIsFetchingDay] = useState(false);
  const [userBaseBusyEvents, setUserBaseBusyEvents] = useState<CalendarEvent[]>([]);
  const [userLiveBookings, setUserLiveBookings] = useState<DocumentData[]>([]);

  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(60);
  const queryRequestIdRef = React.useRef(0);
  // Request-sequence guards so a slow response is discarded when a newer
  // load (or unmount under StrictMode double-mount) has superseded it.
  const bookingsRequestIdRef = React.useRef(0);
  const gcalRequestIdRef = React.useRef(0);

  const [sessionSeed] = useState(() => {
    let seed = sessionStorage.getItem('coach_discovery_seed');
    if (!seed) {
      seed = Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('coach_discovery_seed', seed);
    }
    return seed;
  });

  const userBusyEvents = useMemo(() => {
    const baseGoogleEvents = userBaseBusyEvents.filter(e => e.type !== EVENT_TYPE.PEER_COACHING);
    const currentUid = currentUser?.uid;
    if (!currentUid) return baseGoogleEvents;
    
    const liveUserEvents: CalendarEvent[] = [];
    userLiveBookings.forEach(b => {
      if (b.status === BOOKING_STATUS.CANCELLED) return;
      if (b.coachUid !== currentUid && b.clientUid !== currentUid) return;
      
      const startStr = b.startTime && typeof b.startTime.toDate === 'function' 
        ? b.startTime.toDate().toISOString() 
        : (b.startTime?.dateTime || b.startTime);
      const endStr = b.endTime && typeof b.endTime.toDate === 'function' 
        ? b.endTime.toDate().toISOString() 
        : (b.endTime?.dateTime || b.endTime);
      if (!startStr || !endStr) return;
      
      liveUserEvents.push({
        id: b.bookingId || `${currentUid}-${startStr}`,
        bookingId: b.bookingId,
        summary: b.topic || 'Peer Coaching',
        description: `Coaching session`,
        start: { dateTime: startStr },
        end: { dateTime: endStr },
        type: EVENT_TYPE.PEER_COACHING,
        meetLink: b.googleMeetLink,
        coachUid: b.coachUid,
        clientUid: b.clientUid
      });
    });
    
    return [...baseGoogleEvents, ...liveUserEvents];
  }, [userBaseBusyEvents, userLiveBookings, currentUser]);
  
  // Tab states
  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const localToday = useMemo(() => getLocalDateInTimezone(new Date(), viewerTimezone), [viewerTimezone]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  
  // Filter states
  const [genderFilter, setGenderFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [qualFilter, setQualFilter] = useState<Qualification | ''>('');
  
  // Booking flow state
  const [activeBookingCoach, setActiveBookingCoach] = useState<UserProfile | null>(null);
  const [activeBookingSlot, setActiveBookingSlot] = useState<{ startTime: Date; endTime: Date } | null>(null);
  
  // Booking view/cancel state
  const [selectedBookingForView, setSelectedBookingForView] = useState<CalendarEvent | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<CalendarEvent | null>(null);


  const [profileCache, setProfileCache] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!currentUser?.uid) return;
    const uidsToFetch = userLiveBookings
      .map(b => b.coachUid === currentUser?.uid ? b.clientUid : b.coachUid)
      .filter((uid): uid is string => !!uid && !profileCache[uid]);

    if (uidsToFetch.length === 0) return;

    const uniqueUids = Array.from(new Set(uidsToFetch));
    getProfiles(uniqueUids).then((fetched) => {
      if (fetched.length === 0) return;
      setProfileCache(prev => {
        const next = { ...prev };
        let changed = false;
        fetched.forEach(p => {
          if (!next[p.userId]) {
            next[p.userId] = p;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }).catch(err => {
      console.error('Error fetching booked participant profiles:', err);
    });
  }, [userLiveBookings, currentUser, profileCache]);

  const isInitialLoading = loadingCalendar;

  // Generate days starting from tomorrow up to the booking horizon in viewer's local timezone
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = BOOKING_START_OFFSET_DAYS; i <= BOOKING_HORIZON_DAYS; i++) {
      const d = new Date(localToday);
      d.setDate(localToday.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [localToday]);

  const idPrefix = useId();
  const qualSelectId = `${idPrefix}qual-select`;
  const durationLabelId = `${idPrefix}duration-label`;

  const activeDayDate = days[selectedDayIndex] || localToday;

  // Generate slots for the active day (used for querying)
  const querySlots = useMemo(() => {
    const arr: { startTime: Date; endTime: Date }[] = [];
    const slotDurationMs = selectedDuration * 60 * 1000;
    for (let i = 0; i < 48; i++) {
      const slotHour = Math.floor(i / 2);
      const slotMin = (i % 2) * 30;
      const startTime = getUtcForLocalDateTime(
        activeDayDate.getFullYear(),
        activeDayDate.getMonth() + 1,
        activeDayDate.getDate(),
        slotHour,
        slotMin,
        viewerTimezone
      );
      const endTime = new Date(startTime.getTime() + slotDurationMs);
      arr.push({ startTime, endTime });
    }
    return arr;
  }, [activeDayDate, viewerTimezone, selectedDuration]);

  // One-shot query for the current user's confirmed bookings. Refreshed on
  // focus and date/filter changes via handleRefresh below (previously a live
  // subscription).
  const loadUserBookings = useCallback(async () => {
    if (!currentUser?.uid) return;
    const requestId = ++bookingsRequestIdRef.current;
    try {
      const bookingsList = await getUserBookings(currentUser.uid);
      if (requestId !== bookingsRequestIdRef.current) return;
      setUserLiveBookings(bookingsList);
    } catch (err) {
      if (requestId !== bookingsRequestIdRef.current) return;
      console.error('Error loading user bookings:', err);
    }
  }, [currentUser]);

  const loadGoogleCalendarEvents = useCallback(async () => {
    // If a Google token was obtained earlier this session but has since expired,
    // force a fresh OAuth redirect rather than loading the dashboard with a
    // silently-empty calendar.
    if (hasExpiredGoogleToken()) {
      login().catch((e) => console.error('Re-authentication redirect failed:', e));
      return;
    }
    const requestId = ++gcalRequestIdRef.current;
    try {
      const allEvents = await getUpcomingEvents();
      if (requestId !== gcalRequestIdRef.current) return;
      setUserBaseBusyEvents(allEvents);
    } catch (e) {
      if (requestId !== gcalRequestIdRef.current) return;
      console.error('Error loading Google Calendar events:', e);
    }
  }, [login]);



  // Full refresh — used for explicit user actions (booking success, cancel) and
  // window-focus. Deliberately NOT wired into the day/filter effect below so that
  // a day-tab click or filter toggle does not re-run the expensive Google
  // Calendar fetch or the own-bookings query.
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadUserBookings(),
      loadGoogleCalendarEvents(),
      Promise.resolve()
    ]);
  }, [loadUserBookings, loadGoogleCalendarEvents]);

  // Refresh everything on window focus (own-slots may have changed in another tab).
  useFocusRefresh(handleRefresh);

  // Mount/user-scoped effect: fetch the viewer's own Calendar busy-events and
  // confirmed bookings once per mount (and when the signed-in user changes).
  // Does NOT depend on day/filter state, so switching day tabs or toggling
  // filters no longer triggers a full Google Calendar reload.
  useEffect(() => {
    void (async () => {
      await Promise.all([loadUserBookings(), loadGoogleCalendarEvents()]);
    })();
  }, [loadUserBookings, loadGoogleCalendarEvents]);

  // Day/filter-scoped effect: subscribe to available coaches for the active day
  useEffect(() => {
    const requestId = ++queryRequestIdRef.current;
    
    void Promise.resolve().then(() => setIsFetchingDay(true));

    const localDayStart = new Date(activeDayDate);
    localDayStart.setHours(0, 0, 0, 0);
    const localDayEnd = new Date(activeDayDate);
    localDayEnd.setHours(23, 59, 59, 999);

    const filters = {
      gender: genderFilter || undefined,
      country: countryFilter || undefined,
      icf_acc: qualFilter === 'ICF ACC' ? true : undefined,
      icf_pcc: qualFilter === 'ICF PCC' ? true : undefined,
      icf_mcc: qualFilter === 'ICF MCC' ? true : undefined,
      icf_actc: qualFilter === 'ICF ACTC' ? true : undefined,
      icf_uncertified: qualFilter === 'No Verified Credentials' ? true : undefined,
    };

    let isCleanedUp = false;
    let unsubscribeFn: (() => void) | null = null;

    subscribeAvailableCoachesForDay(
      localDayStart,
      localDayEnd,
      querySlots,
      filters,
      sessionSeed,
      currentUser?.uid,
      (availability) => {
        if (isCleanedUp || requestId !== queryRequestIdRef.current) return;
        setDayAvailability(availability);
        setIsFetchingDay(false);
        setLoadingCalendar(false);
      }
    ).then(unsub => {
      if (isCleanedUp || requestId !== queryRequestIdRef.current) {
        unsub();
      } else {
        unsubscribeFn = unsub;
      }
    }).catch(e => {
      if (isCleanedUp || requestId !== queryRequestIdRef.current) return;
      console.error('Error subscribing to day availability:', e);
      setIsFetchingDay(false);
      setLoadingCalendar(false);
    });

    return () => {
      isCleanedUp = true;
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, [activeDayDate, querySlots, genderFilter, countryFilter, qualFilter, sessionSeed, currentUser]);
  // Handle booking success with optimistic updates
  const handleBookingSuccess = (newEvent: CalendarEvent) => {
    if (activeBookingCoach && newEvent.start.dateTime) {
      const coachId = activeBookingCoach.userId;
      const startStr = newEvent.start.dateTime;
      setDayAvailability(prev => {
        const existing = prev[startStr] || [];
        return {
          ...prev,
          [startStr]: existing.filter(c => c.userId !== coachId)
        };
      });
    }

    setUserBaseBusyEvents(prev => {
      if (prev.some(e => e.id === newEvent.id)) return prev;
      return [...prev, newEvent];
    });

    handleRefresh();
  };


  const clearFilters = () => {
    setGenderFilter('');
    setCountryFilter('');
    setQualFilter('');
    setSelectedDuration(60);
  };


  const getFormattedDateTime = (dateTimeStr: string) => {
    const d = new Date(dateTimeStr);
    const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ` ${getTimezoneCode(d, viewerTimezone)}`;
    return { date, time };
  };


  return (
    <>
      <div className="animate-fade-in" style={{ width: '100%' }}>

      <div className="dashboard-layout">
          {/* Advanced Filter panel */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Filter size={15} color="hsl(var(--primary))" />
                Filter Available Coaches
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Qualifications */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={qualSelectId}>Qualifications</label>
                <div style={{ position: 'relative' }}>
                  <Award size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <select
                    id={qualSelectId}
                    className="input-field"
                    value={qualFilter}
                    onChange={(e) => setQualFilter(e.target.value as Qualification | '')}
                    style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                  >
                    <option value="">All Qualifications</option>
                    {QUALIFICATION_OPTIONS.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gender */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="gender-filter-select">Gender</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <select
                    id="gender-filter-select"
                    className="input-field"
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                  >
                    <option value="">All Genders</option>
                    {GENDER_OPTIONS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Country */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="country-filter-select">Country</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <select
                    id="country-filter-select"
                    className="input-field"
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                  >
                    <option value="">All Countries</option>
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Session Duration */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                {/* Not a <label>: it names a group of toggle buttons, not a form control. */}
                <span className="form-label" id={durationLabelId}>Session Duration</span>
                <div className="duration-toggle-container" role="group" aria-labelledby={durationLabelId}>
                  <button
                    type="button"
                    aria-pressed={selectedDuration === 30}
                    onClick={() => setSelectedDuration(30)}
                    className={selectedDuration === 30 ? 'btn btn-primary duration-toggle-btn' : 'btn btn-secondary duration-toggle-btn'}
                  >
                    30 Min
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectedDuration === 60}
                    onClick={() => setSelectedDuration(60)}
                    className={selectedDuration === 60 ? 'btn btn-primary duration-toggle-btn' : 'btn btn-secondary duration-toggle-btn'}
                  >
                    1 Hour
                  </button>
                </div>
              </div>
            </div>

            {/* Actions / Reset button */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              borderTop: '1px solid var(--border-light)',
              paddingTop: '16px',
              marginTop: '16px'
            }}>
              {/* Clear Filters action */}
              {(genderFilter || countryFilter || qualFilter || selectedDuration !== 60) && (
                <button
                  onClick={clearFilters}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    height: '28px',
                    gap: '4px',
                    borderColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171'
                  }}
                >
                  <X size={12} />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* SlotPicker component */}
          <SlotPicker
            mode="multi"
            dayAvailability={dayAvailability}
            userBusyEvents={userBusyEvents}
            onSlotSelect={(coach, slot) => {
              if (getGoogleToken() === null) {
                showToast('Google Calendar connection required. Please reconnect your calendar to schedule sessions.', 'error');
                login().catch((e) => console.error('Re-authentication redirect failed:', e));
                return;
              }
              setActiveBookingCoach(coach);
              setActiveBookingSlot(slot);
            }}
            onViewBooking={(booking) => setSelectedBookingForView(booking)}
            onCancelBooking={(booking) => {
              if (getGoogleToken() === null) {
                showToast('Google Calendar connection required. Please reconnect your calendar to cancel sessions.', 'error');
                login().catch((e) => console.error('Re-authentication redirect failed:', e));
                return;
              }
              setBookingToCancel(booking);
            }}
            onClearFilters={clearFilters}
            cancellingId={cancellingId}
            isInitialLoading={isInitialLoading}
            isFetchingDay={isFetchingDay}
            selectedDayIndex={selectedDayIndex}
            onDayChange={(index) => setSelectedDayIndex(index)}
            timezone={viewerTimezone}
            profileCache={profileCache}
            selectedDuration={selectedDuration}
          />
      </div>
    </div>

      {/* Booking confirmation modal overlay */}
      {activeBookingCoach && activeBookingSlot && (
        <ScheduleModal 
          coach={activeBookingCoach}
          startTime={activeBookingSlot.startTime}
          endTime={activeBookingSlot.endTime}
          onClose={() => {
            setActiveBookingCoach(null);
            setActiveBookingSlot(null);
          }}
          onBookingSuccess={(event) => {
            handleBookingSuccess(event);
          }}
        />
      )}

      {/* Booking details view modal overlay */}
      {/* Booking details view modal overlay */}
      <SessionDetailsModal
        isOpen={!!selectedBookingForView}
        onClose={() => setSelectedBookingForView(null)}
        coachName={selectedBookingForView ? getParticipantNames(selectedBookingForView, currentUser?.uid, profile, Object.values(profileCache)).coachName : ''}
        clientName={selectedBookingForView ? getParticipantNames(selectedBookingForView, currentUser?.uid, profile, Object.values(profileCache)).clientName : ''}
        topic={selectedBookingForView ? getBookingTopic(selectedBookingForView) : ''}
        date={selectedBookingForView ? getFormattedDateTime(selectedBookingForView.start.dateTime).date : ''}
        time={selectedBookingForView ? getFormattedDateTime(selectedBookingForView.start.dateTime).time : ''}
        meetLink={selectedBookingForView?.meetLink || null}
      />

      {/* Cancel confirmation modal overlay */}
      <CancelModal
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onConfirm={async () => {
          if (!bookingToCancel) return;
          if (getGoogleToken() === null) {
            showToast('Google Calendar connection required. Please reconnect your calendar to cancel sessions.', 'error');
            login().catch((e) => console.error('Re-authentication redirect failed:', e));
            return;
          }
          const idToCancel = bookingToCancel.id;
          const firestoreId = bookingToCancel.bookingId || bookingToCancel.id;
          setCancellingId(idToCancel);
          try {
            await cancelBooking(firestoreId);
            await handleRefresh();
          } catch (err) {
            console.error('Failed to cancel booking:', err);
            if ((err as { code?: string }).code === BOOKING_ERROR.GOOGLE_TOKEN_EXPIRED) {
              // Expired Google token: send the user through a fresh OAuth
              // redirect instead of a generic failure toast.
              login().catch((e) => console.error('Re-authentication redirect failed:', e));
              return;
            }
            showToast('Failed to cancel booking. Please try again.');
          } finally {
            setCancellingId(null);
            setBookingToCancel(null);
          }
        }}
        isCancelling={!!cancellingId}
        coachName={bookingToCancel ? getParticipantNames(bookingToCancel, currentUser?.uid, profile, Object.values(profileCache)).coachName : ''}
        clientName={bookingToCancel ? getParticipantNames(bookingToCancel, currentUser?.uid, profile, Object.values(profileCache)).clientName : ''}
        topic={bookingToCancel ? getBookingTopic(bookingToCancel) : ''}
        date={bookingToCancel ? getFormattedDateTime(bookingToCancel.start.dateTime).date : ''}
        time={bookingToCancel ? getFormattedDateTime(bookingToCancel.start.dateTime).time : ''}
      />
    </>
  );
};
