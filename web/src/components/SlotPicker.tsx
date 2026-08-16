import React, { useState, useMemo, useCallback, useId, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin, Info, Calendar, RefreshCw } from 'lucide-react';
import { getLocalDateInTimezone, getTimezoneCode, getUtcForLocalDateTime } from '../utils/timezoneHelpers';
import { resolveTabNavigationIndex } from '../utils/keyboardNavigation';
import { sanitizeImageUrl } from '../utils/url';
import { getCredentialBadgeClass, buildDisplayCredentials } from '../utils/credentials';
import { useNavigateToProfile } from '../context/UnsavedChangesContext';
import { formatDisplayName } from '../services/profileService';
import { BOOKING_START_OFFSET_DAYS, BOOKING_HORIZON_DAYS, EVENT_TYPE, type Qualification } from '../config';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../services/types';
import type { CalendarEvent } from '../services/googleCalendar';

interface SlotPickerProps {
  mode: 'single' | 'multi';
  coach?: UserProfile | null;
  availableSlots?: string[]; // Coach's available template slots in single mode
  dayAvailability?: Record<string, UserProfile[]>; // Day availability mapping in multi mode
  userBusyEvents: CalendarEvent[]; // Viewer's busy/coaching slots
  coachBusySlots?: { startTime: Date; endTime: Date }[]; // Coach's busy slots in single mode
  onSlotSelect: (coach: UserProfile, slot: { startTime: Date; endTime: Date }) => void;
  onViewBooking?: (booking: CalendarEvent) => void;
  onCancelBooking?: (booking: CalendarEvent) => void;
  onClearFilters?: () => void;
  cancellingId?: string | null;
  isInitialLoading: boolean;
  isFetchingDay: boolean;
  timezone?: string; // Viewer timezone overrides
  selectedDayIndex: number;
  onDayChange: (index: number) => void;
  profileCache?: Record<string, UserProfile>;
  selectedDuration?: 30 | 60;
}

interface MultiSlot {
  slot: { startTime: Date; endTime: Date };
  coaches: UserProfile[];
  anyAvailable: boolean;
  booking: CalendarEvent | null;
}

interface SingleSlot {
  slot: { startTime: Date; endTime: Date };
  isAvailable: boolean;
}

export const SlotPicker: React.FC<SlotPickerProps> = ({
  mode,
  coach,
  availableSlots = [],
  dayAvailability = {},
  userBusyEvents,
  coachBusySlots = [],
  onSlotSelect,
  onViewBooking,
  onCancelBooking,
  onClearFilters,
  cancellingId = null,
  isInitialLoading,
  isFetchingDay,
  timezone,
  selectedDayIndex,
  onDayChange,
  profileCache = {},
  selectedDuration: propDuration
}) => {
  const { user: currentUser } = useAuth();
  const navigateProfile = useNavigateToProfile();
  const idPrefix = useId();
  const datePanelId = `${idPrefix}panel`;
  const dateTabId = (index: number) => `${idPrefix}tab-${index}`;

  const viewerTimezone = useMemo(() => {
    return timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, [timezone]);

  const [now] = useState(() => Date.now());
  const [focusedTabIndex, setFocusedTabIndex] = useState(selectedDayIndex);
  const [localDuration, setLocalDuration] = useState<30 | 60>(60);
  const selectedDuration = propDuration !== undefined ? propDuration : localDuration;
  const carouselRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const localToday = useMemo(() => {
    return getLocalDateInTimezone(new Date(), viewerTimezone);
  }, [viewerTimezone]);

  // Generate 14 days starting from offset
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = BOOKING_START_OFFSET_DAYS; i <= BOOKING_HORIZON_DAYS; i++) {
      const d = new Date(localToday);
      d.setDate(localToday.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [localToday]);

  const activeDayDate = days[selectedDayIndex] || localToday;

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

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = resolveTabNavigationIndex(e.key, index, days.length);
    if (nextIndex === null) return;
    e.preventDefault();
    setFocusedTabIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const selectDay = (index: number) => {
    onDayChange(index);
    setFocusedTabIndex(index);
  };

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

  // Generate 48 slots for the selected day in local timezone
  const activeDaySlots = useMemo(() => {
    const arr: { startTime: Date; endTime: Date }[] = [];
    const slotDurationMs = selectedDuration * 60 * 1000;
    
    for (let i = 0; i < 48; i++) {
      const slotHour = Math.floor(i / 2);
      const slotMin = (i % 2) * 30;
      
      const year = activeDayDate.getFullYear();
      const month = activeDayDate.getMonth() + 1;
      const date = activeDayDate.getDate();
      
      const startTime = getUtcForLocalDateTime(year, month, date, slotHour, slotMin, viewerTimezone);
      const endTime = new Date(startTime.getTime() + slotDurationMs);
      
      arr.push({ startTime, endTime });
    }
    return arr;
  }, [activeDayDate, viewerTimezone, selectedDuration]);

  // Check viewer busy events
  const getBookingForSlot = useCallback((slotStart: Date) => {
    return userBusyEvents.find(e => {
      if (e.type !== EVENT_TYPE.PEER_COACHING) return false;
      const bookingStart = new Date(e.start.dateTime);
      return slotStart.getTime() === bookingStart.getTime();
    });
  }, [userBusyEvents]);

  const isUserUnavailable = useCallback((slotStart: Date, slotEnd: Date) => {
    return userBusyEvents.some(e => {
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end.dateTime);
      return slotStart < end && slotEnd > start;
    });
  }, [userBusyEvents]);

  const isCoachBusy = useCallback((slotStart: Date, slotEnd: Date) => {
    return coachBusySlots.some(b => {
      return slotStart < b.endTime && slotEnd > b.startTime;
    });
  }, [coachBusySlots]);

  // Compute view contents
  const slotView = useMemo(() => {
    if (mode === 'multi') {
      const enriched: MultiSlot[] = activeDaySlots.map(slot => {
        const isPassed = slot.endTime.getTime() < now;
        const booking = getBookingForSlot(slot.startTime);
        const userUnavailable = isUserUnavailable(slot.startTime, slot.endTime);
        
        if (userUnavailable && !booking) {
          return { slot, coaches: [], anyAvailable: false, booking: null };
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
        
        return { slot, coaches: coachesForSlot, anyAvailable, booking: booking || null };
      });
      
      return {
        displaySlots: enriched.filter(e => e.coaches.length > 0 || e.booking),
        hasGeneralSlots: enriched.some(e => e.anyAvailable)
      };
    } else {
      // mode === 'single'
      const enriched: SingleSlot[] = activeDaySlots.map(slot => {
        const isPassed = slot.endTime.getTime() < now;
        if (isPassed) {
          return { slot, isAvailable: false };
        }
        
        const slotIso = slot.startTime.toISOString();
        let isTemplateAvailable: boolean;
        if (selectedDuration === 30) {
          isTemplateAvailable = availableSlots.includes(slotIso);
        } else {
          // For a 60-minute session, both the first and second 30-minute blocks must be available
          const nextSlotStart = new Date(slot.startTime.getTime() + 30 * 60 * 1000);
          isTemplateAvailable = availableSlots.includes(slotIso) && availableSlots.includes(nextSlotStart.toISOString());
        }

        if (!isTemplateAvailable) {
          return { slot, isAvailable: false };
        }
        
        const coachBusy = isCoachBusy(slot.startTime, slot.endTime);
        const userUnavailable = isUserUnavailable(slot.startTime, slot.endTime);
        
        return {
          slot,
          isAvailable: !coachBusy && !userUnavailable
        };
      });
      
      return {
        displaySlots: enriched,
        hasGeneralSlots: enriched.some(e => e.isAvailable)
      };
    }
  }, [
    mode,
    activeDaySlots,
    dayAvailability,
    availableSlots,
    now,
    getBookingForSlot,
    isUserUnavailable,
    isCoachBusy,
    currentUser,
    profileCache,
    selectedDuration
  ]);

  const hasAnyAvailabilityConfigured = useMemo(() => {
    if (mode === 'multi') return true;
    return availableSlots && availableSlots.length > 0;
  }, [mode, availableSlots]);

  if (mode === 'single' && !hasAnyAvailabilityConfigured) {
    const name = coach ? formatDisplayName(coach) : 'This coach';
    return (
      <div className="glass-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        borderRadius: '16px',
        marginTop: '24px'
      }}>
        <Calendar size={28} style={{ color: 'hsl(var(--text-muted))', marginBottom: '12px', opacity: 0.5 }} />
        <h5 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>
          No availability configured
        </h5>
        <p style={{ fontSize: '0.825rem', color: 'hsl(var(--text-muted))', maxWidth: '380px' }}>
          {name} hasn't set up their availability yet. Check back later.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Duration Selector for Single Mode */}
      {mode === 'single' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
            Session Duration:
          </span>
          {([
            { value: 30, label: '30 Mins' },
            { value: 60, label: '1 Hour' }
          ] as const).map((opt) => {
            const isActive = selectedDuration === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLocalDuration(opt.value)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  borderRadius: '16px',
                  height: '28px',
                  fontWeight: 600
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Date Selector Carousel */}
      <div className="carousel-wrapper">
        <button
          type="button"
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
                  return () => {
                    tabRefs.current[index] = null;
                  };
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
          type="button"
          onClick={scrollNext}
          className="scroll-btn"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Time Slot Agenda Panel */}
      <div
        role="tabpanel"
        id={datePanelId}
        aria-labelledby={dateTabId(selectedDayIndex)}
      >
        {isInitialLoading ? (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px' }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Loading availability...</p>
          </div>
        ) : (
          <div style={{
            opacity: isFetchingDay ? 0.5 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: isFetchingDay ? 'none' : 'auto'
          }}>
            {(() => {
              if (mode === 'multi') {
                const displaySlots = slotView.displaySlots as MultiSlot[];

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
                            {slotCoaches.map((slotCoach) => {
                              let borderCol = 'var(--border-light)';
                              const hasMCC = !!slotCoach.icf_mcc;
                              const hasPCC = !!slotCoach.icf_pcc;
                              const hasACC = !!slotCoach.icf_acc;
                              const displayCredentials = buildDisplayCredentials(slotCoach);
                            
                              if (hasMCC) borderCol = 'hsl(var(--mcc-platinum))';
                              else if (hasPCC) borderCol = 'hsl(var(--pcc-silver))';
                              else if (hasACC) borderCol = 'hsl(var(--acc-gold))';

                              return (
                                <div key={slotCoach.userId} className="mini-coach-card">
                                  <div>
                                    <div className="mini-coach-info">
                                      <button
                                        type="button"
                                        className="mini-coach-avatar-button"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                        onClick={() => navigateProfile(slotCoach.userId)}
                                      >
                                        <img
                                          src={sanitizeImageUrl(slotCoach.photoURL)}
                                          alt=""
                                          className="mini-coach-avatar"
                                          style={{ border: `1.5px solid ${borderCol}` }}
                                        />
                                      </button>
                                      <div className="mini-coach-details">
                                        <button
                                          type="button"
                                          className="mini-coach-name"
                                          aria-label={`View ${formatDisplayName(slotCoach) || 'coach'}'s profile`}
                                          onClick={() => navigateProfile(slotCoach.userId)}
                                        >
                                          {formatDisplayName(slotCoach)}
                                        </button>
                                        <div className="mini-coach-location">
                                          <MapPin size={10} color="hsl(var(--primary))" />
                                          {slotCoach.country || 'Remote'}
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
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mini-coach-bio">
                                      {truncateBio(slotCoach.bio)}
                                    </div>
                                  </div>

                                  {(() => {
                                    const isThisParticipantBooked = booking && (booking.coachUid === slotCoach.userId || booking.clientUid === slotCoach.userId);
                                    if (isThisParticipantBooked) {
                                      return (
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                          <button
                                            type="button"
                                            onClick={() => onViewBooking?.(booking)}
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
                                            type="button"
                                            onClick={() => onCancelBooking?.(booking)}
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
                                          type="button"
                                          onClick={() => onSlotSelect(slotCoach, { startTime: slot.startTime, endTime: slot.endTime })}
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

                const hasGeneralSlots = slotView.hasGeneralSlots;

                if (hasGeneralSlots) {
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
                      {onClearFilters && (
                        <button
                          type="button"
                          onClick={onClearFilters}
                          className="btn btn-secondary"
                          style={{ marginTop: '14px', padding: '6px 14px', fontSize: '0.75rem', height: '30px' }}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  );
                } else {
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
              } else {
                // mode === 'single'
                const displaySlots = slotView.displaySlots as SingleSlot[];
                const hasGeneralSlots = slotView.hasGeneralSlots;

                if (hasGeneralSlots) {
                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '12px',
                      marginTop: '12px'
                    }}>
                      {displaySlots.map(({ slot, isAvailable }) => {
                        if (!isAvailable) return null;
                        const startString = slot.startTime.toLocaleTimeString([], { timeZone: viewerTimezone, hour: '2-digit', minute: '2-digit' });
                        const endString = slot.endTime.toLocaleTimeString([], { timeZone: viewerTimezone, hour: '2-digit', minute: '2-digit' });
                        const timeRangeString = `${startString} - ${endString}`;
                        return (
                          <button
                            key={slot.startTime.toISOString()}
                            type="button"
                            onClick={() => coach && onSlotSelect(coach, { startTime: slot.startTime, endTime: slot.endTime })}
                            className="btn btn-primary"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              height: '64px',
                              fontWeight: 700
                            }}
                          >
                            <span style={{ fontSize: '0.9rem' }}>{timeRangeString}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 500 }}>
                              {getTimezoneCode(slot.startTime, viewerTimezone)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                } else {
                  return (
                    <div className="glass-panel" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '48px 24px',
                      textAlign: 'center',
                      borderRadius: '16px',
                      marginTop: '12px'
                    }}>
                      <Calendar size={28} style={{ color: 'hsl(var(--text-muted))', marginBottom: '12px', opacity: 0.5 }} />
                      <h5 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--text-secondary))' }}>No slots available</h5>
                      <p style={{ fontSize: '0.825rem', color: 'hsl(var(--text-muted))', maxWidth: '380px' }}>
                        There are no bookable coaching slots available for this day.
                      </p>
                    </div>
                  );
                }
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
