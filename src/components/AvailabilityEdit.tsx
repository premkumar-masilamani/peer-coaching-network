import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  recalculateUserAvailability,
  getSchedule,
  updateSchedule,
  timeStringToTimestamp,
  timestampToTimeString
} from '../services/firebaseService';
import type { AvailableDays } from '../services/firebaseService';
import {
  Calendar,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  X,
  Copy,
  RefreshCw
} from 'lucide-react';
import { parseLocalTime } from '../utils/timezoneHelpers';

interface TimeRange {
  start: string;
  end: string;
}

interface DayAvailabilityFormState {
  enabled: boolean;
  slots: TimeRange[];
}

interface AvailableDaysFormState {
  monday: DayAvailabilityFormState;
  tuesday: DayAvailabilityFormState;
  wednesday: DayAvailabilityFormState;
  thursday: DayAvailabilityFormState;
  friday: DayAvailabilityFormState;
  saturday: DayAvailabilityFormState;
  sunday: DayAvailabilityFormState;
}

const DEFAULT_FORM_WEEKLY: AvailableDaysFormState = {
  monday: { enabled: true, slots: [{ start: '9:00 AM', end: '5:00 PM' }] },
  tuesday: { enabled: true, slots: [{ start: '9:00 AM', end: '5:00 PM' }] },
  wednesday: { enabled: true, slots: [{ start: '9:00 AM', end: '5:00 PM' }] },
  thursday: { enabled: true, slots: [{ start: '9:00 AM', end: '5:00 PM' }] },
  friday: { enabled: true, slots: [{ start: '9:00 AM', end: '5:00 PM' }] },
  saturday: { enabled: false, slots: [{ start: '9:00 AM', end: '5:00 PM' }] },
  sunday: { enabled: false, slots: [{ start: '9:00 AM', end: '5:00 PM' }] }
};

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
] as const;

// Generate time options from 12:00 AM to 11:30 PM
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  const periods = ['AM', 'PM'];
  for (let p = 0; p < 2; p++) {
    const period = periods[p];
    for (let h = 0; h < 12; h++) {
      const hour = h === 0 ? 12 : h;
      options.push(`${hour}:00 ${period}`);
      options.push(`${hour}:30 ${period}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AvailabilityEdit: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid || '';

  const [weekly, setWeekly] = useState<AvailableDaysFormState>(DEFAULT_FORM_WEEKLY);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid) return;
      try {
        const sched = await getSchedule(uid);
        if (active) {
          const mappedWeekly = {} as AvailableDaysFormState;
          for (const day of Object.keys(sched.availableDays) as (keyof AvailableDays)[]) {
            const dayData = sched.availableDays[day];
            mappedWeekly[day] = {
              enabled: dayData.enabled,
              slots: dayData.slots.map(s => ({
                start: timestampToTimeString(s.startTime),
                end: timestampToTimeString(s.endTime)
              }))
            };
          }
          setWeekly(mappedWeekly);
          setBlockedDates(sched.blockedDates);
        }
      } catch (e) {
        console.error('Failed to load schedule:', e);
      } finally {
        if (active) {
          setLoadingSchedule(false);
        }
      }
    })();
    return () => { active = false; };
  }, [uid]);

  // UI state
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [blockErrorMsg, setBlockErrorMsg] = useState('');

  // NOTE: the editable form is seeded once from the profile via the useState
  // initializers above. We deliberately do NOT re-sync from later profile
  // snapshots, which would clobber the user's unsaved edits. See BUG-008.

  // Derive the slot-validation message during render — no effect, no setState,
  // so it can never race or trip the cascading-render lint rule. See BUG-015.
  const validationError = (() => {
    for (const day of DAYS_OF_WEEK) {
      const dayData = weekly[day.key];
      if (!dayData.enabled) continue;
      for (const slot of dayData.slots) {
        const startParsed = parseLocalTime(slot.start);
        const endParsed = parseLocalTime(slot.end);
        const startMin = startParsed.hour * 60 + startParsed.minute;
        const endMin = endParsed.hour * 60 + endParsed.minute;
        if (endMin <= startMin) {
          return `Invalid slot on ${day.label}: End time (${slot.end}) must be later than start time (${slot.start}).`;
        }
      }
    }
    return '';
  })();
  const hasValidationError = validationError !== '';

  // Toggle enabling/disabling a day
  const handleDayToggle = (dayKey: keyof AvailableDaysFormState) => {
    setWeekly(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: !prev[dayKey].enabled
      }
    }));
  };

  // Update a specific slot range time value
  const handleSlotTimeChange = (
    dayKey: keyof AvailableDaysFormState,
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setWeekly(prev => {
      const dayData = { ...prev[dayKey] };
      const newSlots = [...dayData.slots];
      newSlots[index] = {
        ...newSlots[index],
        [field]: value
      };
      return {
        ...prev,
        [dayKey]: {
          ...dayData,
          slots: newSlots
        }
      };
    });
  };

  // Add a new slot range for a day
  const handleAddSlot = (dayKey: keyof AvailableDaysFormState) => {
    setWeekly(prev => {
      const dayData = { ...prev[dayKey] };
      const newSlots = [...dayData.slots];
      // Default new slot to 10:00 AM - 4:00 PM or clone the last slot
      const lastSlot = newSlots[newSlots.length - 1];
      newSlots.push({
        start: lastSlot ? lastSlot.end : '10:00 AM',
        end: lastSlot ? '4:00 PM' : '4:00 PM'
      });
      return {
        ...prev,
        [dayKey]: {
          ...dayData,
          slots: newSlots
        }
      };
    });
  };

  // Remove a slot range for a day
  const handleRemoveSlot = (dayKey: keyof AvailableDaysFormState, index: number) => {
    setWeekly(prev => {
      const dayData = { ...prev[dayKey] };
      const newSlots = dayData.slots.filter((_: TimeRange, i: number) => i !== index);
      return {
        ...prev,
        [dayKey]: {
          ...dayData,
          slots: newSlots
        }
      };
    });
  };

  // Copy current schedule to all other days
  const handleApplyToAll = (sourceDayKey: keyof AvailableDaysFormState) => {
    const sourceSlots = weekly[sourceDayKey].slots;
    setWeekly(prev => {
      const nextWeekly = { ...prev };
      Object.keys(nextWeekly).forEach(day => {
        if (day !== sourceDayKey) {
          nextWeekly[day as keyof AvailableDaysFormState] = {
            ...nextWeekly[day as keyof AvailableDaysFormState],
            slots: sourceSlots.map((s: TimeRange) => ({ ...s }))
          };
        }
      });
      return nextWeekly;
    });
    setSuccessMsg(`Applied ${DAYS_OF_WEEK.find(d => d.key === sourceDayKey)?.label} schedule to all other days!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Add blocked date
  const handleAddBlockedDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockedDate) return;

    const todayStr = getTodayDateString();
    if (newBlockedDate < todayStr) {
      setBlockErrorMsg('You cannot block a past date.');
      setTimeout(() => setBlockErrorMsg(''), 3000);
      return;
    }

    if (blockedDates.includes(newBlockedDate)) {
      setBlockErrorMsg('This date is already blocked.');
      setTimeout(() => setBlockErrorMsg(''), 3000);
      return;
    }

    setBlockedDates(prev => [...prev, newBlockedDate].sort());
    setNewBlockedDate('');
    setBlockErrorMsg('');
  };

  // Remove blocked date
  const handleRemoveBlockedDate = (date: string) => {
    setBlockedDates(prev => prev.filter(d => d !== date));
  };

  // Format YYYY-MM-DD to readable date
  const formatReadableDate = (dateStr: string): string => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Save changes to Firestore
  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    // Basic slot validation
    let isValid = true;
    let timeOrderValid = true;
    DAYS_OF_WEEK.forEach(day => {
      const dayData = weekly[day.key];
      if (dayData.enabled) {
        dayData.slots.forEach(slot => {
          if (!TIME_OPTIONS.includes(slot.start) || !TIME_OPTIONS.includes(slot.end)) {
            isValid = false;
          }
          const startParsed = parseLocalTime(slot.start);
          const endParsed = parseLocalTime(slot.end);
          const startMin = startParsed.hour * 60 + startParsed.minute;
          const endMin = endParsed.hour * 60 + endParsed.minute;
          if (endMin <= startMin) {
            timeOrderValid = false;
          }
        });
      }
    });

    if (!isValid) {
      setErrorMsg('Please select valid start and end times for all active slots.');
      setSaving(false);
      return;
    }

    if (!timeOrderValid) {
      setErrorMsg('End times must be later than start times.');
      setSaving(false);
      return;
    }

    try {
      const dbAvailableDays = {} as AvailableDays;
      for (const day of Object.keys(weekly) as (keyof AvailableDaysFormState)[]) {
        const dayData = weekly[day];
        dbAvailableDays[day] = {
          enabled: dayData.enabled,
          slots: dayData.slots.map(s => ({
            startTime: timeStringToTimestamp(s.start),
            endTime: timeStringToTimestamp(s.end)
          }))
        };
      }

      // 1. Update schedule sub-collection
      await updateSchedule(uid, dbAvailableDays, blockedDates);

      // 2. Recompute and write actual busy intervals to availability collection
      await recalculateUserAvailability(uid);

      setSuccessMsg('Availability template and schedules saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to save availability settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingSchedule) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', width: '100%' }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
        <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Syncing schedule...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in availability-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', width: '100%', alignItems: 'start' }}>
      <style>{`
        .availability-layout {
          grid-template-columns: 1fr 340px;
        }
        @media (max-width: 950px) {
          .availability-layout {
            grid-template-columns: 1fr !important;
          }
        }
        .day-row {
          display: flex;
          align-items: flex-start;
          padding: 16px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          min-height: 72px;
        }
        .day-row:last-child {
          border-bottom: none;
        }
        .day-label-column {
          display: flex;
          align-items: center;
          width: 160px;
          flex-shrink: 0;
          padding-top: 6px;
        }
        .slots-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-grow: 1;
        }
        .slot-range-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .time-select {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: hsl(var(--text-primary));
          padding: 8px 12px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
          width: 140px;
        }
        .time-select:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.25);
        }
        .time-select option {
          background: #111;
          color: #fff;
        }
        .action-icon-btn {
          background: transparent;
          border: none;
          color: hsl(var(--text-secondary));
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .action-icon-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: hsl(var(--text-primary));
        }
        .action-icon-btn.remove:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.1);
        }
        .apply-all-btn {
          font-size: 0.75rem;
          color: hsl(var(--primary));
          background: transparent;
          border: none;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s;
          margin-top: 2px;
          align-self: flex-start;
        }
        .apply-all-btn:hover {
          background: rgba(139, 92, 246, 0.08);
          text-decoration: underline;
        }
        .blocked-date-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          margin-bottom: 8px;
          font-size: 0.85rem;
        }
        .blocked-date-item:hover {
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Main Weekly Schedule Panel */}
      <div className="glass-panel" style={{ padding: '32px', position: 'relative' }}>
        {/* Header Title with Save */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Default Availability</h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
              Define the recurring weekly slots when peer coaches can book sessions with you.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || hasValidationError}
            className="btn btn-primary"
            style={{
              padding: '8px 24px',
              fontWeight: 700,
              borderRadius: '8px',
              minWidth: '100px',
              opacity: (saving || hasValidationError) ? 0.5 : 1,
              cursor: (saving || hasValidationError) ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="badge badge-approved" style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', gap: '8px' }}>
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}
        {(validationError || errorMsg) && (
          <div className="badge badge-pending" style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <AlertTriangle size={16} />
            <span>{validationError || errorMsg}</span>
          </div>
        )}

        {/* Weekly Day List */}
        <div>
          {DAYS_OF_WEEK.map(({ key, label }) => {
            const daySched = weekly[key];
            return (
              <div key={key} className="day-row">
                {/* Checkbox Column */}
                <div className="day-label-column">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
                    <input
                      type="checkbox"
                      checked={daySched.enabled}
                      onChange={() => handleDayToggle(key)}
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: 'hsl(var(--primary))',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ color: daySched.enabled ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>
                      {label}
                    </span>
                  </label>
                </div>

                {/* Slots Column */}
                <div className="slots-column">
                  {daySched.enabled ? (
                    <>
                      {daySched.slots.map((slot, index) => (
                        <div key={index} className="slot-range-row">
                          <select
                            className="time-select"
                            value={slot.start}
                            onChange={(e) => handleSlotTimeChange(key, index, 'start', e.target.value)}
                          >
                            {TIME_OPTIONS.map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                          <select
                            className="time-select"
                            value={slot.end}
                            onChange={(e) => handleSlotTimeChange(key, index, 'end', e.target.value)}
                          >
                            {TIME_OPTIONS.map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>

                          {/* Plus button next to first slot */}
                          {index === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAddSlot(key)}
                              className="action-icon-btn"
                              title="Add time slot range"
                            >
                              <Plus size={18} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(key, index)}
                              className="action-icon-btn remove"
                              title="Remove time slot range"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Apply To All action link */}
                      {key === 'monday' && (
                        <button
                          type="button"
                          className="apply-all-btn"
                          onClick={() => handleApplyToAll(key)}
                        >
                          <Copy size={12} />
                          Apply To All
                        </button>
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', fontStyle: 'italic', paddingTop: '6px' }}>
                      Unavailable
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Block Dates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Block Dates Card Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'hsl(var(--primary))' }} />
            Block dates
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginBottom: '16px', lineHeight: 1.4 }}>
            Add specific dates when you will be unavailable to take peer coaching calls.
          </p>

          {/* Local Block Date Error message */}
          {blockErrorMsg && (
            <div className="badge badge-pending" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '14px', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center' }}>
              <AlertTriangle size={14} />
              <span>{blockErrorMsg}</span>
            </div>
          )}

          {/* Date Adder Form */}
          <form onSubmit={handleAddBlockedDate} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <input
              type="date"
              className="input-field"
              min={getTodayDateString()}
              value={newBlockedDate}
              onChange={(e) => {
                setNewBlockedDate(e.target.value);
                setBlockErrorMsg('');
              }}
              style={{ width: '100%', minHeight: '38px', fontSize: '0.85rem' }}
            />
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', fontWeight: 600 }}
            >
              Add unavailable date
            </button>
          </form>

          {/* Blocked Date List */}
          <div>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Blocked Dates
            </h4>
            {blockedDates.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No dates are blocked.
              </p>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {blockedDates.map(date => (
                  <div key={date} className="blocked-date-item">
                    <span style={{ fontWeight: 500 }}>{formatReadableDate(date)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlockedDate(date)}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                      title="Remove block date"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
