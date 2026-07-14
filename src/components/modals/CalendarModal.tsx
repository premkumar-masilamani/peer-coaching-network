import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from './Modal';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (dateString: string) => void;
  blockedDates?: string[];
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  blockedDates = []
}) => {
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const todayStr = new Date().toISOString().split('T')[0];

  const renderDays = () => {
    const days = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Render weekday headers
    weekdays.forEach(day => {
      days.push(
        <div key={day} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', padding: '8px 0' }}>
          {day}
        </div>
      );
    });

    // Empty cells for the first week
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} />);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      // Adjust timezone offset to avoid getting previous day due to UTC conversion
      const localDateObj = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
      const dateString = localDateObj.toISOString().split('T')[0];
      
      const isPast = dateString < todayStr;
      const isToday = dateString === todayStr;
      const isBlocked = blockedDates.includes(dateString);

      // Determine styling based on state
      let bgColor = 'var(--panel-bg)';
      let borderColor = 'rgba(139, 92, 246, 0.1)';
      let textColor = 'hsl(var(--text-primary))';

      if (isPast) {
        bgColor = 'transparent';
        textColor = 'hsl(var(--text-muted))';
      } else if (isBlocked) {
        bgColor = 'rgba(239, 68, 68, 0.1)';
        borderColor = 'rgba(239, 68, 68, 0.3)';
        textColor = '#f87171'; // red
      } else if (isToday) {
        borderColor = 'hsl(var(--primary))';
      }

      days.push(
        <button
          key={`day-${i}`}
          onClick={() => !isPast && onSelectDate(dateString)}
          disabled={isPast}
          style={{
            background: bgColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            padding: '10px 4px',
            color: textColor,
            cursor: isPast ? 'not-allowed' : 'pointer',
            opacity: isPast ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: isToday ? 700 : 500,
            transition: 'all 0.2s ease',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            if (!isPast && !isBlocked) {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'hsl(var(--primary))';
            } else if (isBlocked && !isPast) {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isPast && !isBlocked) {
              e.currentTarget.style.background = 'var(--panel-bg)';
              e.currentTarget.style.borderColor = isToday ? 'hsl(var(--primary))' : 'rgba(139, 92, 246, 0.1)';
            } else if (isBlocked && !isPast) {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }
          }}
        >
          {i}
        </button>
      );
    }

    return days;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="450px">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={handleToday}
          style={{
            background: 'transparent',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.8rem',
            color: 'hsl(var(--primary))',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Today
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button 
          type="button"
          onClick={handlePrevMonth}
          style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', padding: '4px' }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {monthNames[month]} {year}
        </div>
        <button 
          type="button"
          onClick={handleNextMonth}
          style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', padding: '4px' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {renderDays()}
      </div>
    </Modal>
  );
};
