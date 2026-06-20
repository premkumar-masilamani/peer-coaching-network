import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToActiveCoaches, formatDisplayName, subscribeToBookings } from '../services/firebaseService';
import { getShortCredential, getCredentialBadgeClass, getCredentialDescription } from '../utils/credentials';
import type { UserProfile } from '../services/firebaseService';
import { 
  getUpcomingEvents, 
  getCoachesBusySlots,
  cancelBooking
} from '../services/googleCalendar';
import type { CalendarEvent } from '../services/googleCalendar';
import type { DocumentData } from 'firebase/firestore';
import { ScheduleModal } from './ScheduleModal';
import { 
  Filter, 
  Search, 
  MapPin, 
  Award, 
  User as UserIcon, 
  Calendar, 
  X,
  RefreshCw,
  Clock,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getLocalDateInTimezone, getUtcForSlot, getTimezoneCode } from '../utils/timezoneHelpers';
import { sanitizeImageUrl } from '../utils/url';
import { BOOKING_START_OFFSET_DAYS, BOOKING_HORIZON_DAYS, BOOKING_STATUS, GENDER_OPTIONS, type Qualification, QUALIFICATION_OPTIONS } from '../config';


export const CoachDashboard: React.FC = () => {
  const { user: currentUser, profile } = useAuth();
  
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
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [coachesBaseBusy, setCoachesBaseBusy] = useState<Record<string, CalendarEvent[]>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [userBaseBusyEvents, setUserBaseBusyEvents] = useState<CalendarEvent[]>([]);
  const [liveBookings, setLiveBookings] = useState<DocumentData[]>([]);
  const [now] = useState(() => Date.now());

  // Derive live coachesBusy and userBusyEvents states by combining the baseline data
  // with the real-time bookings feed in-memory. See Issue 13.
  const coachesBusy = useMemo(() => {
    const result: Record<string, CalendarEvent[]> = {};
    Object.keys(coachesBaseBusy).forEach(uid => {
      result[uid] = [...coachesBaseBusy[uid]];
    });
    
    const nowMs = now;
    liveBookings.forEach(b => {
      if (b.status === BOOKING_STATUS.CANCELLED) return;
      const startStr = b.startTime && typeof b.startTime.toDate === 'function' 
        ? b.startTime.toDate().toISOString() 
        : (b.startTime?.dateTime || b.startTime);
      const endStr = b.endTime && typeof b.endTime.toDate === 'function' 
        ? b.endTime.toDate().toISOString() 
        : (b.endTime?.dateTime || b.endTime);
      if (!startStr || !endStr) return;
      if (new Date(endStr).getTime() < nowMs) return;
      
      const overlayForUid = (uid: string) => {
        if (!(uid in result)) return;
        const already = result[uid].some(e =>
          new Date(e.start.dateTime).getTime() === new Date(startStr).getTime()
        );
        if (already) return;
        result[uid].push({
          id: `booking-${b.bookingId || `${uid}-${startStr}`}`,
          summary: 'Busy',
          start: { dateTime: startStr },
          end: { dateTime: endStr }
        });
      };
      overlayForUid(b.coachUid);
      overlayForUid(b.clientUid);
    });
    return result;
  }, [coachesBaseBusy, liveBookings, now]);

  const userBusyEvents = useMemo(() => {
    const baseGoogleEvents = userBaseBusyEvents.filter(e => e.type !== 'peer-coaching');
    const currentUid = currentUser?.uid;
    if (!currentUid) return baseGoogleEvents;
    
    const liveUserEvents: CalendarEvent[] = [];
    liveBookings.forEach(b => {
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
        type: 'peer-coaching',
        meetLink: b.googleMeetLink,
        coachUid: b.coachUid,
        clientUid: b.clientUid
      });
    });
    
    return [...baseGoogleEvents, ...liveUserEvents];
  }, [userBaseBusyEvents, liveBookings, currentUser]);
  
  // Tab states
  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const localToday = useMemo(() => getLocalDateInTimezone(new Date(), viewerTimezone), [viewerTimezone]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  
  // Filter states
  const [nameSearch, setNameSearch] = useState('');
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

  const getBookingForSlot = (slotStart: Date, slotEnd: Date) => {
    return userBusyEvents.find(e => {
      if (e.type !== 'peer-coaching') return false;
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end.dateTime);
      return slotStart < end && slotEnd > start;
    });
  };
  
  const isInitialLoading = loadingCoaches || (loadingCalendar && Object.keys(coachesBusy).length === 0);

  // Generate days starting from tomorrow up to the booking horizon in viewer's local timezone
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = BOOKING_START_OFFSET_DAYS; i < BOOKING_HORIZON_DAYS; i++) {
      const d = new Date(localToday);
      d.setDate(localToday.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [localToday]);

  const activeDayDate = days[selectedDayIndex] || localToday;

  // Generate slots for the active day
  const slots = useMemo(() => {
    const arr: { hour: number; startTime: Date; endTime: Date }[] = [];
    for (let hour = 8; hour < 20; hour++) {
      arr.push({
        hour,
        startTime: getUtcForSlot(activeDayDate, hour, viewerTimezone),
        endTime: getUtcForSlot(activeDayDate, hour + 1, viewerTimezone)
      });
    }
    return arr;
  }, [activeDayDate, viewerTimezone]);

  // Fetch active peer coaches only (server-side filtered, not the whole users
  // collection). See BUG-006.
  useEffect(() => {
    const unsub = subscribeToActiveCoaches((usersList) => {
      const peerCoaches = usersList.filter((u) => u.userId !== currentUser?.uid);
      setCoaches(peerCoaches);
      setLoadingCoaches(false);
    });

    return () => unsub();
  }, [currentUser]);

  // Real-time bookings subscription to dynamically update coach availability and prevent race conditions. See Issue 13.
  useEffect(() => {
    const unsub = subscribeToBookings((bookingsList) => {
      setLiveBookings(bookingsList);
    });
    return () => unsub();
  }, []);

  // Load calendar availability for coaches + user upcoming sessions
  const loadCalendarData = async () => {
    if (coaches.length === 0) {
      setLoadingCalendar(false);
      return;
    }
    setLoadingCalendar(true);
    try {
      const today = getLocalDateInTimezone(new Date(), viewerTimezone);
      const startDay = new Date(today);
      startDay.setDate(today.getDate() + BOOKING_START_OFFSET_DAYS);
      const timeMin = getUtcForSlot(startDay, 0, viewerTimezone).toISOString();
      const endDay = new Date(today);
      endDay.setDate(today.getDate() + BOOKING_HORIZON_DAYS);
      const timeMax = getUtcForSlot(endDay, 24, viewerTimezone).toISOString();

      const availability = await getCoachesBusySlots(coaches, timeMin, timeMax);
      setCoachesBaseBusy(availability);

      const allEvents = await getUpcomingEvents();
      setUserBaseBusyEvents(allEvents);
    } catch (e) {
      console.error('Error fetching dashboard calendar details:', e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Load calendar data when the coach list changes. Runs inside an async IIFE so
  // no setState happens synchronously in the effect body (no setTimeout hack).
  // loadingCalendar already starts true, so we don't re-show the spinner here.
  // See BUG-007.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = getLocalDateInTimezone(new Date(), viewerTimezone);
        const startDay = new Date(today);
        startDay.setDate(today.getDate() + BOOKING_START_OFFSET_DAYS);
        const timeMin = getUtcForSlot(startDay, 0, viewerTimezone).toISOString();
        const endDay = new Date(today);
        endDay.setDate(today.getDate() + BOOKING_HORIZON_DAYS);
        const timeMax = getUtcForSlot(endDay, 24, viewerTimezone).toISOString();

        const availability = await getCoachesBusySlots(coaches, timeMin, timeMax);
        if (cancelled) return;
        setCoachesBaseBusy(availability);

        const allEvents = await getUpcomingEvents();
        if (cancelled) return;
        setUserBaseBusyEvents(allEvents);
      } catch (e) {
        console.error('Error fetching dashboard calendar details:', e);
      } finally {
        if (!cancelled) setLoadingCalendar(false);
      }
    })();
    return () => { cancelled = true; };
  }, [coaches, viewerTimezone]);

  // Handle booking success with optimistic updates
  const handleBookingSuccess = (newEvent: CalendarEvent) => {
    if (activeBookingCoach) {
      const coachId = activeBookingCoach.userId;
      setCoachesBaseBusy(prev => {
        const existing = prev[coachId] || [];
        if (existing.some(e => e.id === newEvent.id)) return prev;
        return {
          ...prev,
          [coachId]: [...existing, newEvent]
        };
      });
    }

    setUserBaseBusyEvents(prev => {
      if (prev.some(e => e.id === newEvent.id)) return prev;
      return [...prev, newEvent];
    });

    // Trigger full background sync
    loadCalendarData();
  };

  // Check if coach has overlaps
  const isCoachBusy = (coachId: string, slotStart: Date, slotEnd: Date) => {
    const busyEvents = coachesBusy[coachId] || [];
    return busyEvents.some(e => {
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end.dateTime);
      return slotStart < end && slotEnd > start;
    });
  };

  // Check if current user has a calendar conflict
  const hasUserConflict = (slotStart: Date, slotEnd: Date) => {
    return userBusyEvents.some(e => {
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end.dateTime);
      return slotStart < end && slotEnd > start;
    });
  };

  // Handle qualification filter toggle
  const toggleQualFilter = (qual: Qualification) => {
    if (selectedQuals.includes(qual)) {
      setSelectedQuals(selectedQuals.filter(q => q !== qual));
    } else {
      setSelectedQuals([...selectedQuals, qual]);
    }
  };

  const clearFilters = () => {
    setNameSearch('');
    setGenderFilter('');
    setCountryFilter('');
    setSelectedQuals([]);
  };

  // Get available and filtered coaches for a specific slot
  const getCoachesForSlot = (slotStart: Date, slotEnd: Date, ignoreFilters = false) => {
    // 1. First find coaches who are working and not busy
    const available = coaches.filter(coach => {
      // Checks if coach has busy slots (which includes template gaps, blocked dates, bookings, and google calendar)
      const busy = isCoachBusy(coach.userId, slotStart, slotEnd);
      return !busy;
    });

    if (ignoreFilters) {
      return available;
    }

    // 2. Apply filters
    return available.filter(coach => {
      const matchesSearch = nameSearch === '' ? true :
        (coach.displayName?.toLowerCase() || '').includes(nameSearch.toLowerCase());

      const matchesGender = genderFilter === '' ? true : coach.gender === genderFilter;

      const matchesCountry = countryFilter === '' ? true : coach.country === countryFilter;

      const matchesQuals = selectedQuals.length === 0 ? true : (
        selectedQuals.some(q => coach.qualifications?.includes(q))
      );

      return matchesSearch && matchesGender && matchesCountry && matchesQuals;
    });
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

  const truncateBio = (text?: string, limit = 90) => {
    if (!text) return 'No biography provided yet.';
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '...';
  };

  // Precompute, once per relevant-input change, the filtered coaches per slot —
  // instead of calling getCoachesForSlot three times per render. See BUG-006.
  const slotView = useMemo(() => {
    const enriched = slots.map(slot => {
      const isPassed = slot.endTime.getTime() < now;
      
      // Always get all available coaches for this slot
      let coachesForSlot = isPassed ? [] : getCoachesForSlot(slot.startTime, slot.endTime, false);
      let anyAvailable = isPassed ? false : getCoachesForSlot(slot.startTime, slot.endTime, true).length > 0;
      
      // Check if there is an active booking for this slot
      const booking = getBookingForSlot(slot.startTime, slot.endTime);
      let conflict: boolean;
      
      if (booking) {
        // Ensure the booked coach is included (and placed first) even if their template marks them busy now
        const bookedCoach = coaches.find(c => c.userId === booking.coachUid);
        if (bookedCoach) {
          coachesForSlot = coachesForSlot.filter(c => c.userId !== bookedCoach.userId);
          coachesForSlot.unshift(bookedCoach);
        }
        anyAvailable = true;
        conflict = true; // A booking in this slot is a conflict for other coaches
      } else {
        conflict = hasUserConflict(slot.startTime, slot.endTime);
      }
      
      return { slot, isPassed, coaches: coachesForSlot, anyAvailable, conflict, booking };
    });
    return {
      displaySlots: enriched.filter(e => !e.isPassed && e.coaches.length > 0),
      hasGeneralSlots: enriched.some(e => e.anyAvailable)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, coaches, coachesBusy, userBusyEvents, now, nameSearch, genderFilter, countryFilter, selectedQuals]);

  return (
    <>
      <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Dynamic styles */}
      <style>{`
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

        .slot-row.has-conflict {
          border-color: hsl(var(--warning) / 0.4);
          border-left: 4px solid hsl(var(--warning));
          background: var(--bg-surface);
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

        .mini-coach-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .mini-coach-details {
          overflow: hidden;
        }

        .mini-coach-name {
          font-size: 0.9rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  onClick={loadCalendarData} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px', gap: '6px' }}
                  disabled={loadingCalendar || loadingCoaches}
                >
                  <RefreshCw size={12} className={loadingCalendar ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Qualifications Custom Dropdown */}
              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label className="form-label">Qualifications</label>
                <div style={{ position: 'relative' }}>
                  <Award size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', zIndex: 10 }} />
                  <button
                    type="button"
                    onClick={() => setQualsDropdownOpen(!qualsDropdownOpen)}
                    className="input-field"
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
                              {getShortCredential(q)}
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
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '20px 0 16px 0' }} />

            {/* Search by Name (Free Text) */}
            <div className="form-group" style={{ maxWidth: '400px', marginBottom: 0 }}>
              <label className="form-label" htmlFor="name-search-input">Search by Name</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  id="name-search-input"
                  type="text"
                  className="input-field"
                  placeholder="Enter coach name..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                />
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
              {(nameSearch || genderFilter || countryFilter || selectedQuals.length > 0) && (
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

            <div ref={carouselRef} className="date-tabs-container">
              {days.map((day, index) => {
                const isActive = index === selectedDayIndex;
                return (
                  <div 
                    key={day.toISOString()}
                    onClick={() => setSelectedDayIndex(index)}
                    className={`date-tab ${isActive ? 'active' : ''}`}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: isActive ? 0.9 : 0.6 }}>
                      {formatTabDayName(day)}
                    </span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>
                      {formatTabDate(day)}
                    </span>
                  </div>
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

          {/* Time Slot Agenda List */}
          {isInitialLoading ? (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
              <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Computing multi-timezone schedules...</p>
            </div>
          ) : (
            <div>
              {(() => {
                // Slots that are not passed and have at least one matching coach,
                // precomputed in `slotView`. See BUG-006.
                const displaySlots = slotView.displaySlots;

                if (displaySlots.length > 0) {
                  return displaySlots.map(({ slot, conflict, booking, coaches: slotCoaches }) => {
                    return (
                      <div 
                        key={slot.hour} 
                        className={`slot-row ${conflict && !booking ? 'has-conflict' : ''} ${booking ? 'has-booking' : ''}`}
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
                              <>
                                {conflict && (
                                  <span className="badge badge-pending" style={{ fontSize: '0.65rem', gap: '4px' }}>
                                    <AlertTriangle size={10} />
                                    Your Calendar Conflict
                                  </span>
                                )}
                                <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>
                                  {slotCoaches.length} Available
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="slot-coaches-list">
                          <div className="slot-coaches-grid">
                            {slotCoaches.map((coach) => {
                              // Border mapping based on highest qualification
                              let borderCol = 'var(--border-light)';
                              const hasMCC = coach.qualifications?.some(q => getShortCredential(q) === 'MCC');
                              const hasPCC = coach.qualifications?.some(q => getShortCredential(q) === 'PCC');
                              const hasACC = coach.qualifications?.some(q => getShortCredential(q) === 'ACC');
                              if (hasMCC) borderCol = 'hsl(var(--mcc-platinum))';
                              else if (hasPCC) borderCol = 'hsl(var(--pcc-silver))';
                              else if (hasACC) borderCol = 'hsl(var(--acc-gold))';

                              // slotCoaches are already filtered to non-busy coaches,
                              // so the only remaining disabler is the viewer's own conflict.
                              const isDisabled = conflict;

                              return (
                                <div key={coach.userId} className="mini-coach-card">
                                  <div>
                                    <div className="mini-coach-info">
                                      <img
                                        src={sanitizeImageUrl(coach.photoURL)}
                                        alt={formatDisplayName(coach) || 'Coach'}
                                        className="mini-coach-avatar"
                                        style={{ border: `1.5px solid ${borderCol}` }}
                                      />
                                      <div className="mini-coach-details">
                                        <div className="mini-coach-name">{formatDisplayName(coach)}</div>
                                        <div className="mini-coach-location">
                                          <MapPin size={10} color="hsl(var(--primary))" />
                                          {coach.country || 'Remote'}
                                        </div>
                                        <div className="mini-coach-quals">
                                          {coach.qualifications?.map(q => {
                                            const shortCode = getShortCredential(q);
                                            const qBadge = getCredentialBadgeClass(q);
                                            return (
                                              <span key={q} className={`badge ${qBadge}`} style={{ fontSize: '0.55rem', padding: '2px 6px' }}>
                                                {shortCode}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mini-coach-bio">
                                      {truncateBio(coach.bio)}
                                    </div>
                                  </div>

                                  {(() => {
                                    const isThisCoachBooked = booking && booking.coachUid === coach.userId;
                                    if (isThisCoachBooked) {
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
                                    } else if (booking) {
                                      return (
                                        <button
                                          disabled={true}
                                          className="btn btn-disabled"
                                          style={{
                                            width: '100%',
                                            padding: '6px 12px',
                                            fontSize: '0.85rem',
                                            borderRadius: '8px',
                                            height: '36px',
                                            fontWeight: 700,
                                            cursor: 'not-allowed'
                                          }}
                                        >
                                          Session Booked
                                        </button>
                                      );
                                    } else {
                                      return (
                                        <button
                                          onClick={() => {
                                            setActiveBookingCoach(coach);
                                            setActiveBookingSlot({ startTime: slot.startTime, endTime: slot.endTime });
                                          }}
                                          disabled={isDisabled}
                                          className={isDisabled ? "btn btn-disabled" : "btn btn-primary"}
                                          style={{
                                            width: '100%',
                                            padding: '6px 12px',
                                            fontSize: '0.85rem',
                                            borderRadius: '8px',
                                            height: '36px',
                                            fontWeight: 700,
                                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                                          }}
                                        >
                                          {conflict ? 'Conflict' : 'Book Session'}
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
                // all (ignoring filters), precomputed in slotView. See BUG-006.
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
                      <h5 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>No matching coaches</h5>
                      <p style={{ fontSize: '0.825rem', color: 'hsl(var(--text-secondary))', maxWidth: '380px' }}>
                        No coaches matching your filter criteria are available on this day. Try clearing or relaxing your search filters.
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
      {selectedBookingForView && (
        <div className="modal-overlay" style={{ pointerEvents: 'auto' }}>
          <div className="glass-panel modal-content" style={{ padding: '32px', position: 'relative', maxWidth: '440px', width: '100%', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedBookingForView(null)} 
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: 'hsl(var(--text-muted))',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '20px' }}>
              Session Details
            </h3>

            <div className="glass-panel" style={{ padding: '20px', background: 'var(--panel-hover-bg)', marginBottom: '24px' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                <strong>Coach:</strong> {selectedBookingForView.attendees?.find(a => a.email !== currentUser?.email)?.displayName || 'Coach'}
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                <strong>Topic:</strong> {selectedBookingForView.description?.replace('Peer Coaching Network session on the topic: ', '').replace('. Created via PCN.', '') || selectedBookingForView.summary}
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                <strong>Time:</strong> {new Date(selectedBookingForView.start.dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(selectedBookingForView.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              
              {selectedBookingForView.meetLink && (
                <div style={{
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <a
                    href={selectedBookingForView.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', width: '100%', gap: '6px' }}
                  >
                    Join Google Meet
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <button onClick={() => setSelectedBookingForView(null)} className="btn btn-secondary" style={{ width: '100%' }}>
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal overlay */}
      {bookingToCancel && (
        <div className="modal-overlay" style={{ pointerEvents: 'auto' }}>
          <div className="glass-panel modal-content" style={{ padding: '32px', position: 'relative', maxWidth: '440px', width: '100%', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            
            {/* Warning Icon */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', textAlign: 'center' }}>
              Cancel Session?
            </h3>

            <div className="glass-panel" style={{ padding: '20px', background: 'var(--panel-hover-bg)', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                <strong>Coach:</strong> {bookingToCancel.attendees?.find(a => a.email !== currentUser?.email)?.displayName || 'Coach'}
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                <strong>Topic:</strong> {bookingToCancel.description?.replace('Peer Coaching Network session on the topic: ', '').replace('. Created via PCN.', '') || bookingToCancel.summary}
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                <strong>Time:</strong> {new Date(bookingToCancel.start.dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(bookingToCancel.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '24px', lineHeight: 1.4, textAlign: 'center' }}>
              Are you sure you want to cancel this peer coaching session? This will remove the event from Google Calendar and release the slot.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={async () => {
                  const idToCancel = bookingToCancel.id;
                  setBookingToCancel(null);
                  setCancellingId(idToCancel);
                  try {
                    await cancelBooking(idToCancel);
                    await loadCalendarData();
                  } catch (err) {
                    console.error('Failed to cancel booking:', err);
                    alert('Failed to cancel booking. Please try again.');
                  } finally {
                    setCancellingId(null);
                  }
                }}
                className="btn btn-danger"
                style={{
                  width: '100%',
                  fontWeight: 600
                }}
              >
                Yes, Cancel Session
              </button>
              <button
                onClick={() => setBookingToCancel(null)}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                No, Keep Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
