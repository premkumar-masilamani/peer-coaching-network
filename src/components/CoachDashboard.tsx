import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToAllUsers, formatDisplayName } from '../services/firebaseService';
import { getShortCredential, getCredentialBadgeClass } from '../utils/credentials';
import type { UserProfile } from '../services/firebaseService';
import { 
  getUpcomingEvents, 
  getCoachesAvailability, 
  isCalendarSynced 
} from '../services/googleCalendar';
import type { CalendarEvent } from '../services/googleCalendar';
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
  Video,
  ExternalLink,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';

const getTimezoneCode = (date: Date, timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short'
    }).formatToParts(date);
    return parts.find(p => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone;
  }
};

const getLocalDateInTimezone = (date: Date, timeZone: string): Date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(date);
  
  const y = parseInt(parts.find(p => p.type === 'year')!.value);
  const m = parseInt(parts.find(p => p.type === 'month')!.value);
  const d = parseInt(parts.find(p => p.type === 'day')!.value);
  
  return new Date(y, m - 1, d);
};

const getUtcForSlot = (date: Date, hour: number, timeZone: string): Date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  let utcGuess = new Date(Date.UTC(year, month - 1, day, hour));
  
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(utcGuess);
    
    const tzYear = parseInt(parts.find(p => p.type === 'year')!.value);
    const tzMonth = parseInt(parts.find(p => p.type === 'month')!.value);
    const tzDay = parseInt(parts.find(p => p.type === 'day')!.value);
    const tzHour = parseInt(parts.find(p => p.type === 'hour')!.value);
    const tzMinute = parseInt(parts.find(p => p.type === 'minute')!.value);
    
    const targetMinutes = hour * 60;
    const currentMinutes = tzHour * 60 + tzMinute;
    
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0));
    const currentDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, 0, 0));
    const dayDiff = (targetDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);
    
    const diffMinutes = dayDiff * 24 * 60 + (targetMinutes - currentMinutes);
    if (diffMinutes === 0) break;
    
    utcGuess = new Date(utcGuess.getTime() + diffMinutes * 60 * 1000);
  }
  return utcGuess;
};

const isSlotInCoachWorkingHours = (slotStart: Date, slotEnd: Date, coachTimezone: string): boolean => {
  const getHourAndMin = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: coachTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(date);
    
    return {
      year: parseInt(parts.find(p => p.type === 'year')!.value),
      month: parseInt(parts.find(p => p.type === 'month')!.value),
      day: parseInt(parts.find(p => p.type === 'day')!.value),
      hour: parseInt(parts.find(p => p.type === 'hour')!.value),
      minute: parseInt(parts.find(p => p.type === 'minute')!.value)
    };
  };

  try {
    const startLocal = getHourAndMin(slotStart);
    const endLocal = getHourAndMin(slotEnd);

    if (startLocal.year !== endLocal.year || startLocal.month !== endLocal.month || startLocal.day !== endLocal.day) {
      return false;
    }

    const startVal = startLocal.hour + startLocal.minute / 60;
    const endVal = endLocal.hour + endLocal.minute / 60;

    return startVal >= 8 && endVal <= 20;
  } catch (e) {
    console.error('Error computing working hours for coach timezone:', coachTimezone, e);
    return false;
  }
};

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
  const [coachesBusy, setCoachesBusy] = useState<Record<string, CalendarEvent[]>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [upcomingSessions, setUpcomingSessions] = useState<CalendarEvent[]>([]);
  const [userBusyEvents, setUserBusyEvents] = useState<CalendarEvent[]>([]);
  const [now] = useState(() => Date.now());
  
  // Tab states
  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const localToday = getLocalDateInTimezone(new Date(), viewerTimezone);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  
  // Filter states
  const [nameSearch, setNameSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedQuals, setSelectedQuals] = useState<string[]>([]);
  const [qualsDropdownOpen, setQualsDropdownOpen] = useState(false);
  
  // Booking flow state
  const [activeBookingCoach, setActiveBookingCoach] = useState<UserProfile | null>(null);
  const [activeBookingSlot, setActiveBookingSlot] = useState<{ startTime: Date; endTime: Date } | null>(null);
  
  const calendarConnected = isCalendarSynced();

  const isInitialLoading = loadingCoaches || (loadingCalendar && Object.keys(coachesBusy).length === 0);

  // Generate 56 days (2 months) in viewer's local timezone
  const days: Date[] = [];
  for (let i = 0; i < 56; i++) {
    const d = new Date(localToday);
    d.setDate(localToday.getDate() + i);
    days.push(d);
  }

  const activeDayDate = days[selectedDayIndex] || localToday;

  // Generate slots for the active day
  const slots = [];
  for (let hour = 8; hour < 20; hour++) {
    const startTime = getUtcForSlot(activeDayDate, hour, viewerTimezone);
    const endTime = getUtcForSlot(activeDayDate, hour + 1, viewerTimezone);
    slots.push({
      hour,
      startTime,
      endTime
    });
  }

  // Fetch all peer coaches
  useEffect(() => {
    const unsub = subscribeToAllUsers((usersList) => {
      const peerCoaches = usersList.filter(
        (u) => (u.role === 'user' || u.role === 'admin') && u.uid !== currentUser?.uid
      );
      setCoaches(peerCoaches);
      setLoadingCoaches(false);
    });

    return () => unsub();
  }, [currentUser]);

  // Load calendar availability for coaches + user upcoming sessions
  const loadCalendarData = async () => {
    if (coaches.length === 0) {
      setLoadingCalendar(false);
      return;
    }
    setLoadingCalendar(true);
    try {
      const today = getLocalDateInTimezone(new Date(), viewerTimezone);
      const timeMin = getUtcForSlot(today, 0, viewerTimezone).toISOString();
      const endDay = new Date(today);
      endDay.setDate(today.getDate() + 56);
      const timeMax = getUtcForSlot(endDay, 24, viewerTimezone).toISOString();

      const availability = await getCoachesAvailability(!!profile?.role, coaches, timeMin, timeMax);
      setCoachesBusy(availability);

      const allEvents = await getUpcomingEvents(!!profile?.role);
      setUserBusyEvents(allEvents);
      
      const userSessions = allEvents.filter(e => e.summary.toLowerCase().includes('coaching'));
      setUpcomingSessions(userSessions);
    } catch (e) {
      console.error('Error fetching dashboard calendar details:', e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      if (coaches.length > 0) {
        loadCalendarData();
      } else {
        setLoadingCalendar(false);
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaches]);

  // Handle booking success with optimistic updates
  const handleBookingSuccess = (newEvent: CalendarEvent) => {
    if (activeBookingCoach) {
      const coachId = activeBookingCoach.uid;
      setCoachesBusy(prev => {
        const existing = prev[coachId] || [];
        if (existing.some(e => e.id === newEvent.id)) return prev;
        return {
          ...prev,
          [coachId]: [...existing, newEvent]
        };
      });
    }

    setUserBusyEvents(prev => {
      if (prev.some(e => e.id === newEvent.id)) return prev;
      return [...prev, newEvent];
    });

    setUpcomingSessions(prev => {
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
  const toggleQualFilter = (qual: string) => {
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
      const coachTz = coach.timezone || 'UTC';
      // Checks standard 8 AM - 8 PM local business hours in the coach's timezone
      const inWorkingHours = isSlotInCoachWorkingHours(slotStart, slotEnd, coachTz);
      if (!inWorkingHours) return false;

      // Checks if coach has google calendar busy slots
      const busy = isCoachBusy(coach.uid, slotStart, slotEnd);
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

      const matchesCountry = countryFilter === '' ? true : coach.location?.country === countryFilter;

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

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Dynamic styles */}
      <style>{`
        .dashboard-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
          align-items: start;
        }

        .carousel-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.4);
          color: hsl(var(--text-secondary));
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .scroll-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(139, 92, 246, 0.3);
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
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
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
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(139, 92, 246, 0.2);
        }

        .date-tab.active {
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 4px 14px 0 rgba(139, 92, 246, 0.25);
        }

        .slot-row {
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          transition: all 0.2s ease;
        }

        .slot-row.has-conflict {
          border-color: rgba(245, 158, 11, 0.15);
          background: linear-gradient(to right, rgba(245, 158, 11, 0.02), rgba(15, 23, 42, 0.65));
        }

        .slot-row.is-passed {
          opacity: 0.5;
          background: rgba(15, 23, 42, 0.3);
        }

        .slot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .mini-coach-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(139, 92, 246, 0.2);
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
          background: rgba(255, 255, 255, 0.04);
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
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-left: 3px solid hsl(var(--primary));
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 12px;
          transition: all 0.2s ease;
        }

        .session-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 1024px) {
          .dashboard-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="dashboard-layout">
        {/* Main schedule view (Left Column) */}
        <div style={{ minWidth: 0 }}>
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
                
                {!calendarConnected && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    color: '#fbbf24',
                    fontSize: '0.75rem'
                  }}>
                    <Calendar size={12} />
                    <span>Offline calendar mode</span>
                  </div>
                )}
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
                      background: 'rgba(15, 23, 42, 0.4)',
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
                        background: 'hsl(var(--bg-card, 15 23 42))',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        zIndex: 100,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                      }}>
                        {['ICF ACC', 'ICF PCC', 'ICF MCC'].map(q => {
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
                                color: 'white',
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
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Prefer not to say">Prefer not to say</option>
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

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0 16px 0' }} />

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
              borderTop: '1px solid rgba(255,255,255,0.05)',
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
                const isTodayTab = index === 0;
                return (
                  <div 
                    key={day.toISOString()}
                    onClick={() => setSelectedDayIndex(index)}
                    className={`date-tab ${isActive ? 'active' : ''}`}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: isActive ? 0.9 : 0.6 }}>
                      {isTodayTab ? 'Today' : formatTabDayName(day)}
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
                // Filter slots to only those that:
                // 1. Are not passed
                // 2. Have at least one coach available matching the active filter criteria (skip empty slots)
                const displaySlots = slots.filter(slot => {
                  const isPassed = slot.endTime.getTime() < now;
                  if (isPassed) return false;
                  
                  const slotCoaches = getCoachesForSlot(slot.startTime, slot.endTime, false);
                  return slotCoaches.length > 0;
                });

                if (displaySlots.length > 0) {
                  return displaySlots.map((slot) => {
                    const conflict = hasUserConflict(slot.startTime, slot.endTime);
                    const slotCoaches = getCoachesForSlot(slot.startTime, slot.endTime, false);
                    
                    return (
                      <div 
                        key={slot.hour} 
                        className={`slot-row ${conflict ? 'has-conflict' : ''}`}
                      >
                        <div className="slot-header">
                          <div className="slot-time">
                            <Clock size={16} color="hsl(var(--primary))" />
                            <span>{formatSlotTime(slot.startTime, slot.endTime)}</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {conflict && (
                              <span className="badge badge-pending" style={{ fontSize: '0.65rem', gap: '4px' }}>
                                <AlertTriangle size={10} />
                                Your Calendar Conflict
                              </span>
                            )}
                            <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>
                              {slotCoaches.length} Available
                            </span>
                          </div>
                        </div>

                        <div className="slot-coaches-list">
                          <div className="slot-coaches-grid">
                            {slotCoaches.map((coach) => {
                              // Border mapping based on highest qualification
                              let borderCol = 'rgba(255,255,255,0.06)';
                              const hasMCC = coach.qualifications?.some(q => getShortCredential(q) === 'MCC');
                              const hasPCC = coach.qualifications?.some(q => getShortCredential(q) === 'PCC');
                              const hasACC = coach.qualifications?.some(q => getShortCredential(q) === 'ACC');
                              if (hasMCC) borderCol = 'hsl(var(--mcc-platinum))';
                              else if (hasPCC) borderCol = 'hsl(var(--pcc-silver))';
                              else if (hasACC) borderCol = 'hsl(var(--acc-gold))';

                              return (
                                <div key={coach.uid} className="mini-coach-card">
                                  <div>
                                    <div className="mini-coach-info">
                                      <img 
                                        src={coach.photoURL || 'https://api.dicebear.com/7.x/bottts/svg'} 
                                        alt={formatDisplayName(coach) || 'Coach'} 
                                        className="mini-coach-avatar"
                                        style={{ border: `1.5px solid ${borderCol}` }}
                                      />
                                      <div className="mini-coach-details">
                                        <div className="mini-coach-name">{formatDisplayName(coach)}</div>
                                        <div className="mini-coach-location">
                                          <MapPin size={10} color="hsl(var(--primary))" />
                                          {coach.location?.country || 'Remote'}
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

                                  <button
                                    onClick={() => {
                                      setActiveBookingCoach(coach);
                                      setActiveBookingSlot({ startTime: slot.startTime, endTime: slot.endTime });
                                    }}
                                    className="btn btn-primary"
                                    style={{
                                      width: '100%',
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      borderRadius: '8px',
                                      height: '32px',
                                      boxShadow: 'none'
                                    }}
                                  >
                                    Book Session
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  });
                }

                // If displaySlots.length === 0, check if there are general available slots (ignoring filters)
                const hasGeneralSlots = slots.some(slot => {
                  const isPassed = slot.endTime.getTime() < now;
                  if (isPassed) return false;
                  return getCoachesForSlot(slot.startTime, slot.endTime, true).length > 0;
                });

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

        {/* Sidebar overview (Right Column) */}
        <div className="glass-panel" style={{ padding: '24px', position: 'sticky', top: '24px' }}>
          <h3 className="sidebar-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="hsl(var(--primary))" />
            My Booked Sessions
          </h3>

          {(() => {
            const todayStart = localToday.getTime();
            const filteredSessions = upcomingSessions.filter(s => new Date(s.start.dateTime).getTime() >= todayStart);

            if (loadingCalendar) {
              return <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Updating sessions...</p>;
            }
            if (filteredSessions.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'hsl(var(--text-muted))' }}>
                  <Clock size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>No upcoming peer sessions. Select a coach in the schedule to book a session.</p>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredSessions.map((session) => {
                  const start = new Date(session.start.dateTime);
                  const isPassedSession = start.getTime() < now;
                  
                  const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;
                  const timeStr = start.toLocaleTimeString([], { timeZone: viewerTimezone, ...timeOpts });
                  const dateStr = start.toLocaleDateString([], { timeZone: viewerTimezone, month: 'short', day: 'numeric', weekday: 'short' });
                  
                  return (
                    <div 
                      key={session.id} 
                      className="session-card"
                      style={{ 
                        opacity: isPassedSession ? 0.6 : 1,
                        borderLeftColor: isPassedSession ? 'hsl(var(--text-muted))' : 'hsl(var(--primary))'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span className="badge badge-user" style={{ fontSize: '0.55rem', padding: '2px 6px', textTransform: 'none' }}>
                          {isPassedSession ? 'Completed' : 'Confirmed'}
                        </span>
                        {!isPassedSession && session.meetLink && (
                          <span style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Video size={10} /> Meet Link
                          </span>
                        )}
                      </div>
                      
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '8px 0 4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {session.summary}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                        {dateStr} at {timeStr}
                      </p>
                      
                      {!isPassedSession && session.meetLink && (
                        <a 
                          href={session.meetLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary" 
                          style={{
                            marginTop: '10px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            height: '28px',
                            gap: '4px'
                          }}
                        >
                          Join Room
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
    </div>
  );
};
