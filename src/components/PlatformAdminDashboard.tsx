import React, { useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { SystemLogs } from './SystemLogs';
import { SupportDesk } from './SupportDesk';
import { type UserStatus, type UserRole } from '../config';

interface PlatformAdminDashboardProps {
  initialFilter: 'all' | UserStatus | UserRole;
  setInitialFilter: (filter: 'all' | UserStatus | UserRole) => void;
}

export const PlatformAdminDashboard: React.FC<PlatformAdminDashboardProps> = ({
  initialFilter,
  setInitialFilter
}) => {
  const [adminTab, setAdminTab] = useState<'users' | 'logs' | 'support'>('users');

  return (
    <div style={{ padding: '24px' }}>
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px'
      }}>
        <button
          onClick={() => setAdminTab('users')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: adminTab === 'users' ? 'var(--primary)' : 'transparent',
            color: adminTab === 'users' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: adminTab === 'users' ? 600 : 400,
            transition: 'all 0.2s ease'
          }}
        >
          Users & Roles
        </button>
        <button
          onClick={() => setAdminTab('logs')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: adminTab === 'logs' ? 'var(--primary)' : 'transparent',
            color: adminTab === 'logs' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: adminTab === 'logs' ? 600 : 400,
            transition: 'all 0.2s ease'
          }}
        >
          System Logs
        </button>
        <button
          onClick={() => setAdminTab('support')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: adminTab === 'support' ? 'var(--primary)' : 'transparent',
            color: adminTab === 'support' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: adminTab === 'support' ? 600 : 400,
            transition: 'all 0.2s ease'
          }}
        >
          Support Desk
        </button>
      </div>

      <div>
        {adminTab === 'users' && (
          <AdminDashboard
            initialFilter={initialFilter}
            setInitialFilter={setInitialFilter}
          />
        )}
        {adminTab === 'logs' && <SystemLogs />}
        {adminTab === 'support' && <SupportDesk />}
      </div>
    </div>
  );
};
