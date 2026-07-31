import React, { useState } from 'react';
import { UserManagement } from './UserManagement';
import { SystemLogs } from './SystemLogs';
import { SupportDesk } from './SupportDesk';
import { type UserStatus, type UserRole } from '../config';

interface AdminDashboardProps {
  initialFilter: 'all' | UserStatus | UserRole;
  setInitialFilter: (filter: 'all' | UserStatus | UserRole) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
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
        borderBottom: '1px solid var(--glass-border)',
        paddingBottom: '16px'
      }}>
        <button
          onClick={() => setAdminTab('users')}
          className={`btn ${adminTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', borderRadius: '20px' }}
        >
          Users & Roles
        </button>
        <button
          onClick={() => setAdminTab('logs')}
          className={`btn ${adminTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', borderRadius: '20px' }}
        >
          System Logs
        </button>
        <button
          onClick={() => setAdminTab('support')}
          className={`btn ${adminTab === 'support' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', borderRadius: '20px' }}
        >
          Support Desk
        </button>
      </div>

      <div>
        {adminTab === 'users' && (
          <UserManagement
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
