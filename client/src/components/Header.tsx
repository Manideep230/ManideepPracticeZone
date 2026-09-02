import { useState } from 'react';
import { User } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  user: User | null;
  onSignOut: () => void;
  viewMode?: 'playground' | 'admin';
  onToggleViewMode?: () => void;
}

export function Header({ theme, onToggleTheme, user, onSignOut, viewMode, onToggleViewMode }: HeaderProps) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const handleConfirmSignOut = () => {
    setShowSignOutConfirm(false);
    onSignOut();
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="header-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
              <path d="M16 6C16 6 10 10 10 16C10 22 16 26 16 26C16 26 22 22 22 16C22 10 16 6 16 6Z" fill="white" opacity="0.9" />
              <path d="M16 9C16 9 12 12 12 16C12 20 16 23 16 23" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#00ED64" />
                  <stop offset="1" stopColor="#00684A" />
                </linearGradient>
              </defs>
            </svg>
            <div>
              <h1 className="header-title">Manideep Practice Zone</h1>
              <p className="header-subtitle">MongoDB Playground & Permanent Cloud Sandbox</p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {user && user.isAdmin && onToggleViewMode && (
            <button className="btn-admin-toggle" onClick={onToggleViewMode}>
              {viewMode === 'admin' ? '🖥️ Open Playground' : '👑 Admin Portal'}
            </button>
          )}

          {user && (
            <div className="user-badge" title={`Mobile: ${user.mobileNumber} | College: ${user.collegeName} | Branch: ${user.branch} (${user.year})`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="user-roll">{user.rollNumber}</span>
            </div>
          )}

          <button
            className="btn-icon"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            id="theme-toggle"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {user && (
            <button className="btn-logout" onClick={() => setShowSignOutConfirm(true)} title="Sign Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        isOpen={showSignOutConfirm}
        title="Sign Out Confirmation"
        message="Are you sure you want to sign out of your MongoDB Practice Portal?"
        confirmText="Confirm Sign Out"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </>
  );
}
