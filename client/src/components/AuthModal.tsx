import { useState, useEffect } from 'react';
import { DropdownOptions } from '../types';

interface AuthModalProps {
  onSignUp: (rollNumber: string, mobileNumber: string, password: string, collegeName: string, branch: string, year: string) => Promise<boolean>;
  onSignIn: (rollNumber: string, password: string) => Promise<boolean>;
  options: DropdownOptions;
  error: string | null;
  onErrorClear: () => void;
}

export function AuthModal({ onSignUp, onSignIn, options, error, onErrorClear }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [rollNumber, setRollNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Set default dropdown selections when options load
  useEffect(() => {
    if (options.colleges.length > 0 && !collegeName) setCollegeName(options.colleges[0]);
    if (options.branches.length > 0 && !branch) setBranch(options.branches[0]);
    if (options.years.length > 0 && !year) setYear(options.years[0]);
  }, [options, collegeName, branch, year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onErrorClear();
    setSubmitting(true);

    if (isSignUp) {
      await onSignUp(rollNumber, mobileNumber, password, collegeName, branch, year);
    } else {
      await onSignIn(rollNumber, password);
    }

    setSubmitting(false);
  };

  return (
    <div className="auth-overlay" id="auth-modal">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#auth-logo-grad)" />
              <path d="M16 6C16 6 10 10 10 16C10 22 16 26 16 26C16 26 22 22 22 16C22 10 16 6 16 6Z" fill="white" opacity="0.9" />
              <path d="M16 9C16 9 12 12 12 16C12 20 16 23 16 23" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
              <defs>
                <linearGradient id="auth-logo-grad" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#00ED64" />
                  <stop offset="1" stopColor="#00684A" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2 className="auth-title">Manideep Practice Zone</h2>
          <p className="auth-subtitle">
            {isSignUp ? 'Create your personal MongoDB practice portal' : 'Sign in to access your saved MongoDB database'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(true); onErrorClear(); }}
            type="button"
          >
            Sign Up
          </button>
          <button
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(false); onErrorClear(); }}
            type="button"
          >
            Sign In
          </button>
        </div>

        {error && (
          <div className="auth-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="rollNumber">Roll Number</label>
            <input
              id="rollNumber"
              type="text"
              placeholder="e.g. 21CSE101"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              required
              autoFocus
            />
          </div>

          {isSignUp && (
            <>
              <div className="form-group">
                <label htmlFor="mobileNumber">Mobile Number</label>
                <input
                  id="mobileNumber"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="collegeName">College Name</label>
                <select
                  id="collegeName"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="auth-select"
                  required
                >
                  {options.colleges.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="branch">Branch</label>
                  <select
                    id="branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="auth-select"
                    required
                  >
                    {options.branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="year">Year</label>
                  <select
                    id="year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="auth-select"
                    required
                  >
                    {options.years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn-auth-submit" type="submit" disabled={submitting}>
            {submitting ? (
              <span className="spinner" />
            ) : isSignUp ? (
              'Create Practice Portal'
            ) : (
              'Sign In to Portal'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>☁️ All databases & changes are stored permanently on <strong>MongoDB Atlas</strong></p>
        </div>
      </div>
    </div>
  );
}
