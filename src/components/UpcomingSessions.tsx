import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { formatDisplayName, queryAvailableCoachesForDay, getUserBookings, getUserAvailableSlots, getProfiles } from '../services/firebaseService';
import { getCredentialBadgeClass, getCredentialDescription, buildDisplayCredentials } from '../utils/credentials';
import type { UserProfile, DiscoveryFilters } from '../services/firebaseService';
import { 
  getUpcomingEvents,
  cancelBooking
} from '../services/googleCalendar';
import type { CalendarEvent } from '../services/googleCalendar';
import type { DocumentData } from 'firebase/firestore';
import { ScheduleModal } from './modals/ScheduleModal';
import { CancelModal } from './modals/CancelModal';
import { SessionDetailsModal } from './modals/SessionDetailsModal';

import { 
  Filter, 
  MapPin, 
  Award, 
  User as UserIcon, 
  Calendar, 
  X,
  RefreshCw,
  Clock,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getLocalDateInTimezone, getTimezoneCode, getUtcForLocalDateTime, isSlotAvailable } from '../utils/timezoneHelpers';
import { getParticipantNames, getBookingTopic } from '../utils/calendarHelpers';
import { sanitizeImageUrl } from '../utils/url';
import { useNavigateToProfile } from '../context/UnsavedChangesContext';
import { resolveTabNavigationIndex } from '../utils/keyboardNavigation';
import { BOOKING_START_OFFSET_DAYS, BOOKING_HORIZON_DAYS, BOOKING_STATUS, GENDER_OPTIONS, type Qualification, QUALIFICATION, QUALIFICATION_OPTIONS, EVENT_TYPE } from '../config';


export const UpcomingSessions: React.FC = () => {
  const { user: currentUser, profile } = useAuth();
  const navigateToProfile = useNavigateToProfile();
  
  // Ref for date carousel scrolling
  const carouselRef = React.useRef<HTMLDivElement>(null);

  const scrollPrev = () => {
    if (carouselRef.current) {
      const containerWidth = carouselRef.current.clientWidth;
      carouselRef.current.scrollBy({ left: -(containerWidth + 12), behavior: 'smooth' });
    }
  };

  const scrollNext = () => {
    if (carouselRef.current) {
      const containerWidth = carouselRef.current.clientWidth;
      carouselRef.current.scrollBy({ left: containerWidth + 12, behavior: 'smooth' });
    }
  };
  
  // List states
  // List states
  const [dayAvailability, setDayAvailability] = useState<Record<string, UserProfile[]>>({});
  const [currentUserBaseAvailable, setCurrentUserBaseAvailable] = useState<string[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [isFetchingDay, setIsFetchingDay] = useState(false);
  const [userBaseBusyEvents, setUserBaseBusyEvents] = useState<CalendarEvent[]>([]);
  const [userLiveBookings, setUserLiveBookings] = useState<DocumentData[]>([]);
  const [now] = useState(() => Date.now());
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(60);

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
  const [fetchedDayIndex, setFetchedDayIndex] = useState(0);
  
  // Filter states
  const [genderFilter, setGenderFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedQuals, setSelectedQuals] = useState<Qualification[]>([]);
  const [qualsDropdownOpen, setQualsDropdownOpen] = useState(false);
  
  // Booking flow state
  const [activeBookingCoach, setActiveBookingCoach] = useState<UserProfile | null>(null);
  const [activeBookingSlot, setActiveBookingSlot] = useState<{ startTime: Date; endTime: Date } | null>(null);
  
  // Booking view/cancel state
  const [selectedBookingForView, setSelectedBookingForView] = useState<CalendarEvent | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<CalendarEvent | null>(null);

  const getBookingForSlot = useCallback((slotStart: Date) => {
    return userBusyEvents.find(e => {
      if (e.type !== EVENT_TYPE.PEER_COACHING) return false;
      const bookingStart = new Date(e.start.dateTime);
      // Match only the slot whose start time equals the booking's start time.
      // An overlap check (slotStart < bookingEnd && slotEnd > bookingStart) causes
      // a single 1-hour booking to appear in multiple consecutive 60-min slot rows
      // (e.g. 8:30-9:30, 9:00-10:00, and 9:30-10:30 all overlap a 9:00-10:00 booking).
      return slotStart.getTime() === bookingStart.getTime();
    });
  }, [userBusyEvents]);
  
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

  // ARIA tabs, manual activation: arrow keys move focus only, and Enter/Space
  // (native button activation) commits the day. Selecting a day fetches
  // availability, so activating on every arrow press would fire one Firestore
  // query per keystroke and race the responses against each other.
  const [focusedTabIndex, setFocusedTabIndex] = useState(0);
  const idPrefix = useId();
  const datePanelId = `${idPrefix}panel`;
  const dateTabId = (index: number) => `${idPrefix}tab-${index}`;
  const qualsLabelId = `${idPrefix}quals-label`;
  const qualsButtonId = `${idPrefix}quals-button`;
  const durationLabelId = `${idPrefix}duration-label`;

  // Roving tabindex: exactly one tab is reachable via Tab. Buttons are keyed by
  // date and never remount, so the target is mounted and can be focused now.
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = resolveTabNavigationIndex(e.key, index, days.length);
    if (nextIndex === null) return;
    e.preventDefault();
    setFocusedTabIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const selectDay = (index: number) => {
    setSelectedDayIndex(index);
    setFocusedTabIndex(index);
  };

  const activeDayDate = days[selectedDayIndex] || localToday;
  const fetchedDayDate = days[fetchedDayIndex] || localToday;

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

  // Generate slots for the fetched day (used for UI rendering)
  const uiSlots = useMemo(() => {
    const arr: { startTime: Date; endTime: Date }[] = [];
    const slotDurationMs = selectedDuration * 60 * 1000;
    for (let i = 0; i < 48; i++) {
      const slotHour = Math.floor(i / 2);
      const slotMin = (i % 2) * 30;
      const startTime = getUtcForLocalDateTime(
        fetchedDayDate.getFullYear(),
        fetchedDayDate.getMonth() + 1,
        fetchedDayDate.getDate(),
        slotHour,
        slotMin,
        viewerTimezone
      );
      const endTime = new Date(startTime.getTime() + slotDurationMs);
      arr.push({ startTime, endTime });
    }
    return arr;
  }, [fetchedDayDate, viewerTimezone, selectedDuration]);

  // One-shot query for the current user's confirmed bookings. Refreshed on
  // focus and date/filter changes via handleRefresh below (previously a live
  // subscription).
  const loadUserBookings = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const bookingsList = await getUserBookings(currentUser.uid);
      setUserLiveBookings(bookingsList);
    } catch (err) {
      console.error('Error loading user bookings:', err);
    }
  }, [currentUser]);

  const loadCurrentUserAvailableSlots = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const slotsList = await getUserAvailableSlots(currentUser.uid);
      setCurrentUserBaseAvailable(slotsList);
    } catch (err) {
      console.error('Error loading current user available slots:', err);
    }
  }, [currentUser]);

  const loadGoogleCalendarEvents = useCallback(async () => {
    try {
      const allEvents = await getUpcomingEvents();
      setUserBaseBusyEvents(allEvents);
    } catch (e) {
      console.error('Error loading Google Calendar events:', e);
    }
  }, []);

  const loadDayAvailability = useCallback(async () => {
    await Promise.resolve();
    setIsFetchingDay(true);
    try {
      const localDayStart = new Date(activeDayDate);
      localDayStart.setHours(0, 0, 0, 0);
      const localDayEnd = new Date(activeDayDate);
      localDayEnd.setHours(23, 59, 59, 999);

      const filters: DiscoveryFilters = {
        gender: genderFilter || undefined,
        country: countryFilter || undefined,
        icf_acc: selectedQuals.includes('ICF ACC') ? true : undefined,
        icf_pcc: selectedQuals.includes('ICF PCC') ? true : undefined,
        icf_mcc: selectedQuals.includes('ICF MCC') ? true : undefined,
        icf_actc: selectedQuals.includes('ICF ACTC') ? true : undefined,
      };

      const availability = await queryAvailableCoachesForDay(
        localDayStart,
        localDayEnd,
        querySlots,
        filters,
        sessionSeed,
        currentUser?.uid
      );
      setDayAvailability(availability);
      setFetchedDayIndex(selectedDayIndex);
    } catch (e) {
      console.error('Error querying day availability:', e);
    } finally {
      setIsFetchingDay(false);
      setLoadingCalendar(false);
    }
  }, [activeDayDate, querySlots, genderFilter, countryFilter, selectedQuals, sessionSeed, currentUser, selectedDayIndex]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadUserBookings(),
      loadCurrentUserAvailableSlots(),
      loadGoogleCalendarEvents(),
      loadDayAvailability()
    ]);
  }, [loadUserBookings, loadCurrentUserAvailableSlots, loadGoogleCalendarEvents, loadDayAvailability]);

  useFocusRefresh(handleRefresh);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await handleRefresh();
    })();
    return () => { active = false; };
  }, [activeDayDate, genderFilter, countryFilter, selectedQuals, currentUser, handleRefresh]);

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

  // Check if current user is unavailable (due to template gaps, blocked dates, or google calendar events, excluding active PCN bookings)
  const isUserUnavailable = useCallback((slotStart: Date, slotEnd: Date) => {
    const currentUid = currentUser?.uid;
    if (currentUid && currentUserBaseAvailable.length > 0) {
      if (!isSlotAvailable(currentUserBaseAvailable, slotStart, slotEnd)) {
        return true;
      }
    }
    return userBusyEvents.some(e => {
      if (e.type === EVENT_TYPE.PEER_COACHING) return false;
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end.dateTime);
      return slotStart < end && slotEnd > start;
    });
  }, [currentUser, currentUserBaseAvailable, userBusyEvents]);

  // Handle qualification filter toggle
  const toggleQualFilter = (qual: Qualification) => {
    if (selectedQuals.includes(qual)) {
      setSelectedQuals(selectedQuals.filter(q => q !== qual));
    } else {
      setSelectedQuals([...selectedQuals, qual]);
    }
  };

  const clearFilters = () => {
    setGenderFilter('');
    setCountryFilter('');
    setSelectedQuals([]);
    setSelectedDuration(60);
  };

  // Formatting helpers
  const formatTabDayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatTabDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatSlotTime = (start: Date, end: Date): string => {
    const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;
    const startStr = start.toLocaleTimeString([], { timeZone: viewerTimezone, ...timeOpts });
    const endStr = end.toLocaleTimeString([], { timeZone: viewerTimezone, ...timeOpts });
    return `${startStr} - ${endStr} ${getTimezoneCode(start, viewerTimezone)}`;
  };



  const getFormattedDateTime = (dateTimeStr: string) => {
    const d = new Date(dateTimeStr);
    const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ` ${getTimezoneCode(d, viewerTimezone)}`;
    return { date, time };
  };

  const truncateBio = (text?: string, limit = 90) => {
    if (!text) return 'No biography provided yet.';
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '...';
  };

  // Precompute, once per relevant-input change, the filtered coaches per slot —
  // instead of calling getCoachesForSlot three times per render.
  const slotView = useMemo(() => {
    const enriched = uiSlots.map(slot => {
      const isPassed = slot.endTime.getTime() < now;
      
      // Check if there is an active booking for this slot
      const booking = getBookingForSlot(slot.startTime);
      
      // If the current user is unavailable at this slot (excluding bookings),
      // we filter it out (hide it) unless there is a booking already!
      const userUnavailable = isUserUnavailable(slot.startTime, slot.endTime);
      if (userUnavailable && !booking) {
        return { slot, isPassed: true, coaches: [], anyAvailable: false, booking: null };
      }
      
      const slotIso = slot.startTime.toISOString();
      let coachesForSlot = isPassed ? [] : (dayAvailability[slotIso] || []);
      let anyAvailable = isPassed ? false : coachesForSlot.length > 0;
      
      if (booking) {
        const otherParticipantId = booking.coachUid === currentUser?.uid ? booking.clientUid : booking.coachUid;
        const bookedUser = otherParticipantId ? profileCache[otherParticipantId] : null;
        if (bookedUser) {
          coachesForSlot = coachesForSlot.filter(c => c.userId !== bookedUser.userId);
          coachesForSlot = [bookedUser, ...coachesForSlot];
        }
        anyAvailable = true;
      }
      
      return { slot, isPassed, coaches: coachesForSlot, anyAvailable, booking };
    });
    return {
      displaySlots: enriched.filter(e => !e.isPassed && (e.coaches.length > 0 || e.booking)),
      hasGeneralSlots: enriched.some(e => e.anyAvailable)
    };
  }, [uiSlots, dayAvailability, profileCache, now, currentUser, getBookingForSlot, isUserUnavailable]);

  return (
    <>
      <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Dynamic styles */}
      <style>{`
        .duration-toggle-container {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .duration-toggle-btn {
          flex: 1;
          font-size: 0.85rem !important;
          padding: 8px 12px !important;
          height: 40px;
        }
        .dashboard-layout {
          width: 100%;
        }

        .carousel-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 12px;
        }

        .date-tabs-container {
          display: flex;
          overflow-x: auto;
          gap: 12px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          /* Hide scrollbar for clean aesthetic since we have buttons */
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex: 1;
          min-width: 0;
          scroll-snap-type: x mandatory;
        }

        .date-tabs-container::-webkit-scrollbar {
          display: none;
        }

        .scroll-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid var(--border-light);
          background: var(--input-bg);
          color: hsl(var(--text-secondary));
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .scroll-btn:hover {
          background: var(--btn-secondary-hover-bg);
          border-color: hsl(var(--primary) / 0.4);
          color: hsl(var(--text-primary));
        }

        .scroll-btn:active {
          transform: scale(0.95);
        }

        .date-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px 18px;
          min-width: 100px;
          flex-shrink: 0;
          cursor: pointer;
          background: var(--input-bg);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          scroll-snap-align: start;
          /* A button resets these; the div this replaced inherited them. */
          font-family: inherit;
          color: inherit;
          text-align: center;
        }

        @media (min-width: 768px) {
          .date-tab {
            flex: 0 0 calc((100% - 72px) / 7);
            min-width: 0;
            padding: 12px 0;
          }
        }

        .date-tab:hover {
          background: var(--panel-hover-bg);
          border-color: hsl(var(--primary) / 0.3);
        }

        .date-tab.active {
          background-color: hsl(var(--primary));
          border-color: transparent;
          color: white;
          box-shadow: var(--card-shadow);
        }

        .slot-row {
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          transition: all 0.2s ease;
        }



        .slot-row.is-passed {
          opacity: 0.5;
          background: hsl(var(--bg-base) / 0.5);
        }

        .slot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 12px;
        }

        .slot-time {
          font-size: 0.95rem;
          font-weight: 700;
          display: flex;
          alignItems: center;
          gap: 8px;
          color: hsl(var(--text-primary));
        }

        .slot-coaches-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .mini-coach-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .mini-coach-card:hover {
          background: var(--panel-hover-bg);
          border-color: hsl(var(--primary) / 0.3);
        }

        .mini-coach-info {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .mini-coach-avatar-button {
          display: block;
          padding: 0;
          background: none;
          border: none;
          border-radius: 50%;
          flex-shrink: 0;
          cursor: pointer;
        }

        .mini-coach-avatar {
          display: block;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .mini-coach-avatar-button:hover .mini-coach-avatar {
          transform: scale(1.05);
          opacity: 0.9;
        }

        .mini-coach-details {
          overflow: hidden;
        }

        .mini-coach-name {
          display: block;
          max-width: 100%;
          font-size: 0.9rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          transition: color 0.15s ease;
          /* Button reset: this was a div. */
          padding: 0;
          background: none;
          border: none;
          text-align: left;
          font-family: inherit;
          color: inherit;
        }

        .mini-coach-name:hover {
          color: hsl(var(--primary));
          text-decoration: underline;
        }


        .mini-coach-location {
          font-size: 0.75rem;
          color: hsl(var(--text-secondary));
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }

        .dropdown-item-label:hover {
          background: var(--panel-hover-bg);
        }

        .mini-coach-quals {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 6px;
        }

        .mini-coach-bio {
          font-size: 0.78rem;
          color: hsl(var(--text-secondary));
          line-height: 1.4;
          margin-bottom: 12px;
        }

        .session-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          border-left: 3px solid hsl(var(--primary));
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 12px;
          transition: all 0.2s ease;
        }

        .session-card:hover {
          background: var(--panel-hover-bg);
          border-color: var(--border-light);
        }

        /* Removed multi-column layout media query */
      `}</style>

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
              {/* Qualifications Custom Dropdown */}
              <div className="form-group" style={{ marginBottom: 0, position: 'relative', zIndex: qualsDropdownOpen ? 100 : 1 }}>
                {/* Not a <label>: it names a custom dropdown button, not a form
                    control, so it associates via aria-labelledby. */}
                <span className="form-label" id={qualsLabelId}>Qualifications</span>
                <div style={{ position: 'relative' }}>
                  <Award size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', zIndex: 10 }} />
                  <button
                    type="button"
                    id={qualsButtonId}
                    onClick={() => setQualsDropdownOpen(!qualsDropdownOpen)}
                    className="input-field"
                    // Names the button "Qualifications, <current selection>". The
                    // disclosed panel is a checkbox group, not a listbox, so
                    // aria-expanded alone describes it; no aria-haspopup.
                    aria-labelledby={`${qualsLabelId} ${qualsButtonId}`}
                    aria-expanded={qualsDropdownOpen}
                    style={{
                      paddingLeft: '34px',
                      fontSize: '0.85rem',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedQuals.length === 0 
                        ? 'All Qualifications' 
                        : selectedQuals.join(', ')}
                    </span>
                    <ChevronDown size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                  </button>
                  {qualsDropdownOpen && (
                    <>
                      {/* Invisible click-catcher that closes the dropdown on an
                          outside click. It is not a control and must stay out of
                          the tab order; keyboard users close the dropdown by
                          re-activating the button above or tabbing past it. */}
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                      <div
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
                        onClick={() => setQualsDropdownOpen(false)}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '105%',
                        left: 0,
                        right: 0,
                        background: 'hsl(var(--bg-surface-elevated))',
                        border: '1px solid var(--border-light)',
                        borderRadius: '12px',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        zIndex: 100,
                        boxShadow: 'var(--glass-shadow)'
                      }}>
                        {QUALIFICATION_OPTIONS.map(q => {
                          const isChecked = selectedQuals.includes(q);
                          return (
                            <label
                              key={q}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                color: 'hsl(var(--text-primary))',
                                transition: 'background 0.2s ease'
                              }}
                              className="dropdown-item-label"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleQualFilter(q)}
                                style={{ accentColor: 'hsl(var(--primary))' }}
                              />
                              {q as string}
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {selectedQuals.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: '0.8rem',
                      color: 'hsl(var(--text-secondary))',
                      paddingLeft: '4px'
                    }}>
                      {selectedQuals.map(q => (
                        <div key={q} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Award size={12} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
                          <span>{getCredentialDescription(q)}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
              {(genderFilter || countryFilter || selectedQuals.length > 0 || selectedDuration !== 60) && (
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

          {/* Date Selector Carousel */}
          <div className="carousel-wrapper">
            <button 
              onClick={scrollPrev} 
              className="scroll-btn"
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>

            <div
              ref={carouselRef}
              className="date-tabs-container"
              role="tablist"
              aria-label="Available dates"
            >
              {days.map((day, index) => {
                const isActive = index === selectedDayIndex;
                return (
                  <button
                    type="button"
                    role="tab"
                    id={dateTabId(index)}
                    aria-selected={isActive}
                    aria-controls={datePanelId}
                    tabIndex={index === focusedTabIndex ? 0 : -1}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                      return () => { tabRefs.current[index] = null; };
                    }}
                    key={day.toISOString()}
                    onClick={() => selectDay(index)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={`date-tab ${isActive ? 'active' : ''}`}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: isActive ? 0.9 : 0.6 }}>
                      {formatTabDayName(day)}
                    </span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>
                      {formatTabDate(day)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button 
              onClick={scrollNext} 
              className="scroll-btn"
              aria-label="Scroll right"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Time Slot Agenda List: the panel the date tabs control. No tabIndex,
              since the panel already holds focusable controls. */}
          <div
            role="tabpanel"
            id={datePanelId}
            aria-labelledby={dateTabId(selectedDayIndex)}
          >
            {isInitialLoading ? (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px' }}>
                <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
                <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Computing multi-timezone schedules...</p>
              </div>
            ) : (
              <div style={{ 
                opacity: isFetchingDay ? 0.5 : 1, 
                transition: 'opacity 0.2s ease', 
                pointerEvents: isFetchingDay ? 'none' : 'auto' 
              }}>
                {(() => {
                  // Slots that are not passed and have at least one matching coach,
                  // precomputed in `slotView`.
                  const displaySlots = slotView.displaySlots;

                  if (displaySlots.length > 0) {
                    return displaySlots.map(({ slot, booking, coaches: slotCoaches }) => {
                      return (
                        <div
                          key={slot.startTime.toISOString()}
                          className={`slot-row ${booking ? 'has-booking' : ''}`}
                        >
                          <div className="slot-header">
                            <div className="slot-time">
                              <Clock size={16} color="hsl(var(--primary))" />
                              <span>{formatSlotTime(slot.startTime, slot.endTime)}</span>
                            </div>
                          
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {booking ? (
                                <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>
                                  Session Already Booked
                                </span>
                              ) : (
                                <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>
                                  {slotCoaches.length} Available
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="slot-coaches-list">
                            <div className="slot-coaches-grid">
                              {slotCoaches.map((coach) => {
                                // Border mapping based on highest qualification
                                let borderCol = 'var(--border-light)';
                                const hasMCC = !!coach.icf_mcc;
                                const hasPCC = !!coach.icf_pcc;
                                const hasACC = !!coach.icf_acc;
                                const displayCredentials = buildDisplayCredentials(coach);
                              
                                if (hasMCC) borderCol = 'hsl(var(--mcc-platinum))';
                                else if (hasPCC) borderCol = 'hsl(var(--pcc-silver))';
                                else if (hasACC) borderCol = 'hsl(var(--acc-gold))';

                                return (
                                  <div key={coach.userId} className="mini-coach-card">
                                    <div>
                                      <div className="mini-coach-info">
                                        {/* A mouse affordance only: it duplicates the name
                                            button below, so keeping it out of the tab order
                                            avoids two stops to the same destination on every
                                            coach card. */}
                                        <button
                                          type="button"
                                          className="mini-coach-avatar-button"
                                          tabIndex={-1}
                                          aria-hidden="true"
                                          onClick={() => navigateToProfile(coach.userId)}
                                        >
                                          <img
                                            src={sanitizeImageUrl(coach.photoURL)}
                                            alt=""
                                            className="mini-coach-avatar"
                                            style={{ border: `1.5px solid ${borderCol}` }}
                                          />
                                        </button>
                                        <div className="mini-coach-details">
                                          <button
                                            type="button"
                                            className="mini-coach-name"
                                            aria-label={`View ${formatDisplayName(coach) || 'coach'}'s profile`}
                                            onClick={() => navigateToProfile(coach.userId)}
                                          >
                                            {formatDisplayName(coach)}
                                          </button>
                                          <div className="mini-coach-location">
                                            <MapPin size={10} color="hsl(var(--primary))" />
                                            {coach.country || 'Remote'}
                                          </div>
                                          <div className="mini-coach-quals">
                                            {displayCredentials.length > 0 ? (
                                              displayCredentials.map((qual, idx) => {
                                                return (
                                                  <span key={idx} className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                                    {qual}
                                                  </span>
                                                );
                                              })
                                            ) : (
                                              <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                                                {QUALIFICATION.UNCERTIFIED}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mini-coach-bio">
                                        {truncateBio(coach.bio)}
                                      </div>
                                    </div>

                                    {(() => {
                                      const isThisParticipantBooked = booking && (booking.coachUid === coach.userId || booking.clientUid === coach.userId);
                                      if (isThisParticipantBooked) {
                                        return (
                                          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            <button
                                              onClick={() => setSelectedBookingForView(booking)}
                                              className="btn btn-secondary"
                                              style={{
                                                flex: 1,
                                                padding: '6px 8px',
                                                fontSize: '0.85rem',
                                                borderRadius: '8px',
                                                height: '36px',
                                                fontWeight: 700
                                              }}
                                            >
                                              View
                                            </button>
                                            <button
                                              onClick={() => setBookingToCancel(booking)}
                                              disabled={cancellingId === booking.id}
                                              className="btn btn-danger"
                                              style={{
                                                flex: 1,
                                                padding: '6px 8px',
                                                fontSize: '0.85rem',
                                                borderRadius: '8px',
                                                height: '36px',
                                                fontWeight: 700
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <button
                                            onClick={() => {
                                              setActiveBookingCoach(coach);
                                              setActiveBookingSlot({ startTime: slot.startTime, endTime: slot.endTime });
                                            }}
                                            className="btn btn-primary"
                                            style={{
                                              width: '100%',
                                              padding: '6px 12px',
                                              fontSize: '0.85rem',
                                              borderRadius: '8px',
                                              height: '36px',
                                              fontWeight: 700,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Book Session
                                          </button>
                                        );
                                      }
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  }

                  // If displaySlots is empty, check whether any slot has coaches at
                  // all (ignoring filters), precomputed in slotView.
                  const hasGeneralSlots = slotView.hasGeneralSlots;

                  if (hasGeneralSlots) {
                    // General slots exist, but filters filtered them all out
                    return (
                      <div className="glass-panel" style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: '48px 24px',
                        textAlign: 'center',
                        background: 'rgba(239, 68, 68, 0.02)',
                        border: '1px dashed rgba(239, 68, 68, 0.15)',
                        borderRadius: '16px'
                      }}>
                        <Info size={28} style={{ color: 'hsl(var(--accent))', marginBottom: '12px', opacity: 0.8 }} />
                        <h5 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>No coaches available</h5>
                        <p style={{ fontSize: '0.825rem', color: 'hsl(var(--text-secondary))', maxWidth: '380px' }}>
                          No coaches are available for this time slot. Try adjusting your filters or selecting a different time.
                        </p>
                        <button 
                          onClick={clearFilters} 
                          className="btn btn-secondary"
                          style={{ marginTop: '14px', padding: '6px 14px', fontSize: '0.75rem', height: '30px' }}
                        >
                          Reset Filters
                        </button>
                      </div>
                    );
                  } else {
                    // No timeslots available at all for this day
                    return (
                      <div className="glass-panel" style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: '48px 24px',
                        textAlign: 'center',
                        borderRadius: '16px'
                      }}>
                        <Calendar size={28} style={{ color: 'hsl(var(--text-muted))', marginBottom: '12px', opacity: 0.5 }} />
                        <h5 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>No slots available</h5>
                        <p style={{ fontSize: '0.825rem', color: 'hsl(var(--text-muted))', maxWidth: '380px' }}>
                          There are no coaching slots available on this day (passed, outside working hours, or fully booked).
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </div>
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
          const idToCancel = bookingToCancel.id;
          setCancellingId(idToCancel);
          try {
            await cancelBooking(idToCancel);
            await handleRefresh();
          } catch (err) {
            console.error('Failed to cancel booking:', err);
            alert('Failed to cancel booking. Please try again.');
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
