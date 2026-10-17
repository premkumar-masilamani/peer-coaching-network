import React from 'react';
import { Home, BookOpen, Calendar, User, MoreHorizontal } from 'lucide-react';
import { TABS, type TabKey } from '../config';

interface BottomNavProps {
  currentTab: TabKey;
  setCurrentTab: (tab: TabKey) => void;
  onOpenMore: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  onOpenMore
}) => {
  const navItems = [
    { key: TABS.DASHBOARD, label: 'Dashboard', icon: <Home size={20} /> },
    { key: TABS.BOOKINGS, label: 'Sessions', icon: <BookOpen size={20} /> },
    { key: TABS.AVAILABILITY, label: 'Availability', icon: <Calendar size={20} /> },
    { key: TABS.PROFILE, label: 'Profile', icon: <User size={20} /> },
  ] as const;

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="bottom-nav-container">
        {navItems.map((item) => {
          const isActive = currentTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setCurrentTab(item.key)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className="bottom-nav-item"
          onClick={onOpenMore}
          aria-label="Open More Menu"
        >
          <span className="bottom-nav-icon">
            <MoreHorizontal size={20} />
          </span>
          <span className="bottom-nav-label">More</span>
        </button>
      </div>
    </nav>
  );
};
