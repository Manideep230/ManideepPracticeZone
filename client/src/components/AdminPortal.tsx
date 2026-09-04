import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DropdownOptions, ExecutionResult } from '../types';
import { ConfirmModal } from './ConfirmModal';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

interface AdminPortalProps {
  token: string | null;
  onGoToPlayground: () => void;
}

interface Student {
  _id: string;
  rollNumber: string;
  mobileNumber: string;
  collegeName?: string;
  branch?: string;
  year?: string;
  userDbName: string;
  createdAt: string;
  isDisabled?: boolean;
  presenceStatus?: 'online' | 'idle' | 'offline';
  idleMinutes?: number;
  lastActiveTime?: string;
  workout?: {
    total: number;
    success: number;
    failed: number;
    lastWorkoutTime?: string | null;
  };
}

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) {
    return `Today — ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (target.getTime() === yesterday.getTime()) {
    return `Yesterday — ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminPortal({ token, onGoToPlayground }: AdminPortalProps) {
  const [options, setOptions] = useState<DropdownOptions>({ colleges: [], branches: [], years: [] });
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'options' | 'students' | 'directory' | 'workouts' | 'playground'>('students');

  // Advanced Multi-Filter Student Directory state
  const [dirPresenceFilter, setDirPresenceFilter] = useState<'all' | 'online' | 'idle' | 'offline' | 'disabled'>('all');
  const [dirCollegeFilter, setDirCollegeFilter] = useState<string>('all');
  const [dirBranchFilter, setDirBranchFilter] = useState<string>('all');
  const [dirYearFilter, setDirYearFilter] = useState<string>('all');
  const [dirWorkoutFilter, setDirWorkoutFilter] = useState<'all' | 'has_workouts' | 'no_workouts' | 'high_activity' | 'has_failures'>('all');
  const [dirSearchQuery, setDirSearchQuery] = useState<string>('');
  const [dirSortBy, setDirSortBy] = useState<'recent_active' | 'roll_asc' | 'roll_desc' | 'commands_desc' | 'created_newest'>('recent_active');
  const [dirPage, setDirPage] = useState<number>(1);
  const [dirPageSize, setDirPageSize] = useState<number>(50);
  
  // Options management form state
  const [newCollege, setNewCollege] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newYear, setNewYear] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Student filter & search state for fast, easy student discovery
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPresenceFilter, setStudentPresenceFilter] = useState<'all' | 'online' | 'idle' | 'offline' | 'disabled'>('all');

  // Option delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'college' | 'branch' | 'year'; name: string } | null>(null);

  // Student delete confirmation modal state & action loading
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Password Reset Modal & Confirmation Popup state
  const [showResetPwdModal, setShowResetPwdModal] = useState(false);
  const [resetRollNumber, setResetRollNumber] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);
  const [showPwdVisibility, setShowPwdVisibility] = useState(false);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState<{ rollNumber: string; newPassword: string } | null>(null);

  // Student History Inspection Modal state
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'all' | 'success' | 'fail'>('all');
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});
  const [historyCopiedId, setHistoryCopiedId] = useState<string | null>(null);

  // Dedicated Live Workouts Feed state
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutFilterRoll, setWorkoutFilterRoll] = useState('all');
  const [workoutFilterStatus, setWorkoutFilterStatus] = useState<'all' | 'success' | 'fail'>('all');
  const [workoutSearch, setWorkoutSearch] = useState('');
  const [workoutLimit, setWorkoutLimit] = useState<string>('all');
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Record<string, boolean>>({});
  const [workoutCopiedId, setWorkoutCopiedId] = useState<string | null>(null);

  // Gmail-style 50 queries per page pagination
  const [workoutPage, setWorkoutPage] = useState<number>(1);
  const [workoutPageSize, setWorkoutPageSize] = useState<number>(50);
  const [pageJumpInput, setPageJumpInput] = useState<string>('1');
  const workoutsFeedTopRef = useRef<HTMLDivElement | null>(null);

  const [adminDbName, setAdminDbName] = useState('user_db_22kt1a4245');
  const [adminCommand, setAdminCommand] = useState('show dbs');
  const [adminExecLoading, setAdminExecLoading] = useState(false);
  const [adminExecResult, setAdminExecResult] = useState<ExecutionResult | null>(null);
  const [pendingDeleteCmd, setPendingDeleteCmd] = useState<string | null>(null);

  // Custom Performance Report Modal State (Date, Time-to-Time, Hourly Breakdown)
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportIsAllDay, setReportIsAllDay] = useState(true);
  const [reportFromTime, setReportFromTime] = useState('09:00');
  const [reportToTime, setReportToTime] = useState('18:00');
  const [reportScope, setReportScope] = useState<'date' | 'all'>('date');
  const [reportBranch, setReportBranch] = useState('all');
  const [reportIncludeHourly, setReportIncludeHourly] = useState(true);
  const [reportGenerating, setReportGenerating] = useState(false);

  // Auto-dismiss status alerts after 4.5s for a clean, non-intrusive UI
  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Smooth ESC key closing for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showReportModal) setShowReportModal(false);
        if (historyStudent) setHistoryStudent(null);
        if (deleteTarget) setDeleteTarget(null);
        if (studentToDelete) setStudentToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReportModal, historyStudent, deleteTarget, studentToDelete]);

  const fetchOptions = () => {
    fetch(`${API_BASE}/options`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.options) setOptions(data.options);
      })
      .catch(() => {});
  };

  const fetchStudents = useCallback(() => {
    fetch(`${API_BASE}/admin/students`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.students) setStudents(data.students);
      })
      .catch(() => {});
  }, [token]);

  // Smooth silent polling: avoid flickering UI on auto-refresh, supports limit=all
  const fetchWorkouts = useCallback((roll = 'all', silent = false, limitChoice?: string) => {
    if (!silent) setWorkoutsLoading(true);
    const activeLimit = limitChoice !== undefined ? limitChoice : workoutLimit;
    const qRoll = roll && roll !== 'all' ? `&roll=${encodeURIComponent(roll)}` : '';
    const qLimit = activeLimit ? `limit=${encodeURIComponent(activeLimit)}` : 'limit=all';
    fetch(`${API_BASE}/admin/workouts?${qLimit}${qRoll}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.workouts)) {
          setAllWorkouts(data.workouts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!silent) setWorkoutsLoading(false);
      });
  }, [token, workoutLimit]);

  useEffect(() => {
    fetchOptions();
    fetchStudents();
  }, [fetchStudents]);

  // Live real-time presence polling every 12 seconds while in Students tab
  useEffect(() => {
    if (activeTab === 'students' && token) {
      const interval = setInterval(fetchStudents, 12000);
      return () => clearInterval(interval);
    }
  }, [activeTab, token, fetchStudents]);

  // Live real-time workout stream polling every 8 seconds while in Workouts tab (silent = true)
  useEffect(() => {
    if (activeTab === 'workouts' && token) {
      fetchWorkouts(workoutFilterRoll, allWorkouts.length > 0, workoutLimit);
      const interval = setInterval(() => fetchWorkouts(workoutFilterRoll, true, workoutLimit), 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab, workoutFilterRoll, token, fetchWorkouts, allWorkouts.length, workoutLimit]);

  // Instant zero-latency memoized student filter
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (s.rollNumber === '22KT1A4245') return false;
      if (studentPresenceFilter === 'online' && s.presenceStatus !== 'online') return false;
      if (studentPresenceFilter === 'idle' && s.presenceStatus !== 'idle') return false;
      if (studentPresenceFilter === 'offline' && s.presenceStatus !== 'offline') return false;
      if (studentPresenceFilter === 'disabled' && !s.isDisabled) return false;

      if (studentSearch.trim()) {
        const term = studentSearch.trim().toLowerCase();
        const rollMatch = (s.rollNumber || '').toLowerCase().includes(term);
        const phoneMatch = (s.mobileNumber || '').toLowerCase().includes(term);
        const branchMatch = (s.branch || '').toLowerCase().includes(term);
        const collegeMatch = (s.collegeName || '').toLowerCase().includes(term);
        return rollMatch || phoneMatch || branchMatch || collegeMatch;
      }
      return true;
    });
  }, [students, studentPresenceFilter, studentSearch]);

  // Memoized filter for live student workouts feed
  const filteredWorkouts = useMemo(() => {
    return allWorkouts.filter(item => {
      if (workoutFilterStatus === 'success' && !item.success) return false;
      if (workoutFilterStatus === 'fail' && item.success) return false;
      if (workoutSearch) {
        const term = workoutSearch.toLowerCase().trim();
        const cmdMatch = (item.command || '').toLowerCase().includes(term);
        const rollMatch = String(item.rollNumber || '').toLowerCase().includes(term);
        return cmdMatch || rollMatch;
      }
      return true;
    });
  }, [allWorkouts, workoutFilterStatus, workoutSearch]);

  const totalWorkoutPages = Math.max(1, Math.ceil(filteredWorkouts.length / workoutPageSize));
  const safeWorkoutPage = Math.min(Math.max(1, workoutPage), totalWorkoutPages);

  const workoutStartIndex = filteredWorkouts.length === 0 ? 0 : (safeWorkoutPage - 1) * workoutPageSize;
  const workoutEndIndex = Math.min(workoutStartIndex + workoutPageSize, filteredWorkouts.length);

  const paginatedWorkouts = useMemo(() => {
    return filteredWorkouts.slice(workoutStartIndex, workoutEndIndex);
  }, [filteredWorkouts, workoutStartIndex, workoutEndIndex]);

  // Keep page jump input synced with safeWorkoutPage
  useEffect(() => {
    setPageJumpInput(String(safeWorkoutPage));
  }, [safeWorkoutPage]);

  // Reset to page 1 whenever filters or page size change
  useEffect(() => {
    setWorkoutPage(1);
  }, [workoutFilterRoll, workoutFilterStatus, workoutSearch, workoutPageSize]);

  const handleWorkoutPageChange = (newPage: number) => {
    const target = Math.max(1, Math.min(newPage, totalWorkoutPages));
    setWorkoutPage(target);
    if (workoutsFeedTopRef.current) {
      workoutsFeedTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleJumpToPage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const p = parseInt(pageJumpInput, 10);
    if (!isNaN(p)) {
      handleWorkoutPageChange(p);
    } else {
      setPageJumpInput(String(safeWorkoutPage));
    }
  };

  const renderGmailPagination = (position: 'top' | 'bottom') => {
    return (
      <div className={`gmail-pagination-bar gmail-pagination-${position}`}>
        <div className="gmail-pagination-left">
          <span className="gmail-pagination-summary">
            {filteredWorkouts.length > 0 ? (
              <>
                <span className="gmail-range-highlight">
                  {(workoutStartIndex + 1).toLocaleString()}–{workoutEndIndex.toLocaleString()}
                </span>
                <span className="gmail-of-text"> of </span>
                <span className="gmail-total-highlight">
                  {filteredWorkouts.length.toLocaleString()}
                </span>
                <span className="gmail-queries-label"> queries</span>
              </>
            ) : (
              <span className="gmail-no-results">0 queries</span>
            )}
          </span>

          {totalWorkoutPages > 1 && (
            <form onSubmit={handleJumpToPage} className="gmail-page-jump-form" title="Jump directly to any page">
              <label htmlFor={`jump-page-${position}`}>Page</label>
              <input
                id={`jump-page-${position}`}
                type="number"
                min={1}
                max={totalWorkoutPages}
                value={pageJumpInput}
                onChange={e => setPageJumpInput(e.target.value)}
                onBlur={handleJumpToPage}
                className="gmail-jump-input"
              />
              <span className="gmail-jump-total">/ {totalWorkoutPages}</span>
            </form>
          )}
        </div>

        <div className="gmail-pagination-right">
          <div className="gmail-page-size-selector">
            <label htmlFor={`page-size-${position}`}>Show:</label>
            <select
              id={`page-size-${position}`}
              value={workoutPageSize}
              onChange={e => {
                const newSize = Number(e.target.value);
                setWorkoutPageSize(newSize);
                setWorkoutPage(1);
              }}
              className="gmail-size-select"
              title="Number of queries to show per page"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page (Gmail default)</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>
          </div>

          <div className="gmail-pager-controls">
            <span className="gmail-pager-range-text">
              {filteredWorkouts.length === 0
                ? '0 of 0'
                : `${(workoutStartIndex + 1).toLocaleString()}–${workoutEndIndex.toLocaleString()} of ${filteredWorkouts.length.toLocaleString()}`}
            </span>

            <div className="gmail-nav-btn-group">
              <button
                type="button"
                className="gmail-nav-btn"
                disabled={safeWorkoutPage <= 1}
                onClick={() => handleWorkoutPageChange(1)}
                title="First page (1)"
                aria-label="First page"
              >
                ⇤
              </button>

              <button
                type="button"
                className="gmail-nav-btn"
                disabled={safeWorkoutPage <= 1}
                onClick={() => handleWorkoutPageChange(safeWorkoutPage - 1)}
                title="Previous page (Newer queries)"
                aria-label="Previous page"
              >
                ‹
              </button>

              <span className="gmail-current-page-badge" title={`Current Page: ${safeWorkoutPage} of ${totalWorkoutPages}`}>
                {safeWorkoutPage}
              </span>

              <button
                type="button"
                className="gmail-nav-btn"
                disabled={safeWorkoutPage >= totalWorkoutPages}
                onClick={() => handleWorkoutPageChange(safeWorkoutPage + 1)}
                title="Next page (Older queries)"
                aria-label="Next page"
              >
                ›
              </button>

              <button
                type="button"
                className="gmail-nav-btn"
                disabled={safeWorkoutPage >= totalWorkoutPages}
                onClick={() => handleWorkoutPageChange(totalWorkoutPages)}
                title={`Last page (${totalWorkoutPages})`}
                aria-label="Last page"
              >
                ⇥
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleViewStudentHistory = async (student: Student) => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    setHistorySearch('');
    setHistoryFilterStatus('all');
    setExpandedHistoryIds({});
    try {
      const res = await fetch(`${API_BASE}/admin/students/${student.rollNumber}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setStudentHistory(data.history);
      } else {
        setStudentHistory([]);
      }
    } catch {
      setStudentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleStudentStatus = async (student: Student) => {
    setActionLoadingId(student._id);
    try {
      const res = await fetch(`${API_BASE}/admin/students/${student._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isDisabled: !student.isDisabled })
      });
      const data = await res.json();
      if (data.success) {
        setStudents(prev => prev.map(s => s._id === student._id ? { ...s, isDisabled: data.isDisabled } : s));
        setStatusMsg({ type: 'success', text: data.message });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to update student status' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error updating student status' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    const id = studentToDelete._id;
    setStudentToDelete(null);
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/students/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStudents(prev => prev.filter(s => s._id !== id));
        setStatusMsg({ type: 'success', text: data.message });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to remove student' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error removing student' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Password Reset Modal
  const handleOpenPasswordResetModal = (targetRoll?: string) => {
    setResetRollNumber(targetRoll || '');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetPwdError(null);
    setShowPwdVisibility(false);
    setShowResetPwdModal(true);
  };

  // Trigger Confirmation Popup for Password Reset
  const handleInitiatePasswordReset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResetPwdError(null);

    const cleanRoll = resetRollNumber.trim().toUpperCase();
    if (!cleanRoll) {
      setResetPwdError('Please enter a valid student Roll Number.');
      return;
    }

    if (!resetNewPassword || resetNewPassword.trim().length < 4) {
      setResetPwdError('New password must be at least 4 characters long.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetPwdError('New password and Confirm password do not match.');
      return;
    }

    // Trigger confirmation popup before changing password with zero data loss guarantee
    setPendingPasswordReset({
      rollNumber: cleanRoll,
      newPassword: resetNewPassword.trim()
    });
  };

  // Perform actual password reset after confirmation
  const handleConfirmPasswordReset = async () => {
    if (!pendingPasswordReset || !token) return;
    const { rollNumber, newPassword } = pendingPasswordReset;
    setPendingPasswordReset(null);
    setResetPwdLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/students/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rollNumber, newPassword })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to update student password.' });
      } else {
        setStatusMsg({
          type: 'success',
          text: `✅ ${data.message || `Password for student "${rollNumber}" changed successfully with zero data loss!`}`
        });
        setShowResetPwdModal(false);
        setResetRollNumber('');
        setResetNewPassword('');
        setResetConfirmPassword('');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Network error updating password: ' + (err.message || String(err)) });
    } finally {
      setResetPwdLoading(false);
    }
  };

  const saveOptions = async (updated: DropdownOptions) => {
    try {
      const res = await fetch(`${API_BASE}/admin/options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (data.success) {
        setOptions(updated);
        setStatusMsg({ type: 'success', text: 'Dropdown options saved & students synchronized!' });
        fetchStudents();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save options.' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error saving options.' });
    }
  };

  const handleSyncAllStudentsCollege = async () => {
    if (!token || options.colleges.length === 0) return;
    setSyncLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/students/sync-college`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetCollege: options.colleges[0] })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        fetchStudents();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to sync students college' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error synchronizing students' });
    } finally {
      setSyncLoading(false);
    }
  };

  // Open custom performance report modal (Date, Time-to-Time, Hourly Breakdown)
  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  // Generate and download student performance report with date range, time-to-time, and hourly performance
  const handleGenerateCustomReport = async () => {
    setReportGenerating(true);
    try {
      const fromTime = reportIsAllDay ? '00:00' : reportFromTime;
      const toTime = reportIsAllDay ? '23:59' : reportToTime;
      const isAllDates = reportScope === 'all';

      const res = await fetch(`${API_BASE}/admin/reports/hourly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: reportDate,
          fromTime,
          toTime,
          isAllDates
        })
      });

      const data = await res.json();
      if (!data.success) {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to fetch report data.' });
        setReportGenerating(false);
        return;
      }

      // Strictly exclude admin account from students list
      const studentsList: Student[] = (data.students || []).filter(
        (s: Student) => s.rollNumber !== '22KT1A4245' && s.collegeName !== 'Admin Portal'
      );

      // Strictly exclude admin account from workouts
      const workoutsList: any[] = (data.workouts || []).filter(
        (w: any) => String(w.rollNumber).trim().toUpperCase() !== '22KT1A4245'
      );

      // Aggregate workouts per student and per hour in local browser time
      const studentMetrics: Record<string, {
        total: number;
        success: number;
        failed: number;
        hourly: Record<number, number>;
        lastWorkout: Date | null;
      }> = {};

      workoutsList.forEach((w: any) => {
        const roll = String(w.rollNumber || '').trim().toUpperCase();
        if (!roll || roll === '22KT1A4245') return;

        if (!studentMetrics[roll]) {
          studentMetrics[roll] = {
            total: 0,
            success: 0,
            failed: 0,
            hourly: {},
            lastWorkout: null
          };
        }

        studentMetrics[roll].total++;
        if (w.success) studentMetrics[roll].success++;
        else studentMetrics[roll].failed++;

        const d = new Date(w.timestamp);
        if (!isNaN(d.getTime())) {
          const hr = d.getHours();
          studentMetrics[roll].hourly[hr] = (studentMetrics[roll].hourly[hr] || 0) + 1;
          if (!studentMetrics[roll].lastWorkout || d > studentMetrics[roll].lastWorkout!) {
            studentMetrics[roll].lastWorkout = d;
          }
        }
      });

      // Determine active hourly columns to display
      let hoursToShow: number[] = [];
      if (!reportIsAllDay) {
        const startHr = parseInt(reportFromTime.split(':')[0], 10) || 0;
        const endHr = parseInt(reportToTime.split(':')[0], 10) || 23;
        for (let h = startHr; h <= endHr; h++) {
          hoursToShow.push(h);
        }
      } else {
        const activeSet = new Set<number>();
        workoutsList.forEach((w: any) => {
          const d = new Date(w.timestamp);
          if (!isNaN(d.getTime())) activeSet.add(d.getHours());
        });
        hoursToShow = Array.from(activeSet).sort((a, b) => a - b);
        if (hoursToShow.length === 0) {
          hoursToShow = [9, 10, 11, 12, 13, 14, 15, 16, 17];
        }
      }

      const formatHourLabel = (hr: number) => {
        const pad = (n: number) => (n < 10 ? '0' + n : String(n));
        const next = (hr + 1) % 24;
        return `${pad(hr)}:00 - ${pad(next)}:00`;
      };

      const naturalRollSort = (a: Student, b: Student) => {
        return (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true, sensitivity: 'base' });
      };

      const formatStudentRow = (s: Student, idx: number) => {
        const m = studentMetrics[s.rollNumber.toUpperCase()] || {
          total: 0,
          success: 0,
          failed: 0,
          hourly: {},
          lastWorkout: null
        };
        const successRate = m.total > 0 ? `${((m.success / m.total) * 100).toFixed(1)}%` : '0%';
        let lastWorkoutStr = 'None';
        if (m.lastWorkout) {
          lastWorkoutStr = m.lastWorkout.toLocaleString();
        } else if (s.workout?.lastWorkoutTime) {
          const d = new Date(s.workout.lastWorkoutTime);
          lastWorkoutStr = isNaN(d.getTime()) ? String(s.workout.lastWorkoutTime) : d.toLocaleString();
        }

        const row: Record<string, any> = {
          'S.No': idx + 1,
          'Roll Number': s.rollNumber,
          'Mobile Number': s.mobileNumber,
          'College Name': s.collegeName || 'GMRIT College, Vizianagaram',
          'Branch': s.branch || 'General',
          'Academic Year': s.year || 'N/A',
          'Period Queries': m.total,
          'Successful': m.success,
          'Errors': m.failed,
          'Success Rate (%)': successRate
        };

        if (reportIncludeHourly) {
          hoursToShow.forEach(h => {
            row[formatHourLabel(h)] = m.hourly[h] || 0;
          });
        }

        row['Last Activity Time'] = lastWorkoutStr;
        row['Live Presence'] = s.presenceStatus === 'online' ? 'Online' : s.presenceStatus === 'idle' ? 'Idle' : 'Offline';
        row['Account Status'] = s.isDisabled ? 'Disabled' : 'Active';

        return row;
      };

      const colsWidth = [
        { wch: 6 },   // S.No
        { wch: 18 },  // Roll Number
        { wch: 15 },  // Mobile
        { wch: 32 },  // College
        { wch: 12 },  // Branch
        { wch: 12 },  // Year
        { wch: 16 },  // Period Queries
        { wch: 14 },  // Successful
        { wch: 14 },  // Errors
        { wch: 16 }   // Success Rate
      ];

      if (reportIncludeHourly) {
        hoursToShow.forEach(() => colsWidth.push({ wch: 16 }));
      }
      colsWidth.push({ wch: 22 }, { wch: 16 }, { wch: 14 });

      const wb = XLSX.utils.book_new();

      const effectiveStudents = reportBranch === 'all'
        ? studentsList
        : studentsList.filter(s => (s.branch || 'General').trim() === reportBranch);

      const sortedAll = [...effectiveStudents].sort(naturalRollSort);
      const allWs = XLSX.utils.json_to_sheet(sortedAll.map(formatStudentRow));
      allWs['!cols'] = colsWidth;

      const mainSheetTitle = reportBranch === 'all' ? 'All Students' : `${reportBranch} Students`;
      XLSX.utils.book_append_sheet(wb, allWs, mainSheetTitle);

      // If "All Branches", create separate branch sheets (CSE, ECE, etc.) in ascending roll order
      if (reportBranch === 'all') {
        const branches = Array.from(new Set(studentsList.map(s => (s.branch || 'General').trim()))).sort();
        branches.forEach(branch => {
          const branchStudents = studentsList
            .filter(s => (s.branch || 'General').trim() === branch)
            .sort(naturalRollSort);

          if (branchStudents.length > 0) {
            const ws = XLSX.utils.json_to_sheet(branchStudents.map(formatStudentRow));
            ws['!cols'] = colsWidth;
            const cleanSheetName = branch.replace(/[:\\/?*\[\]]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
          }
        });
      }

      // Sheet: Hourly Timeline Summary
      if (reportIncludeHourly && hoursToShow.length > 0) {
        const summaryRows = hoursToShow.map((h, i) => {
          let hTotal = 0;
          let hSuccess = 0;
          let hFail = 0;
          let activeStudentCount = 0;

          effectiveStudents.forEach(s => {
            const m = studentMetrics[s.rollNumber.toUpperCase()];
            const count = m?.hourly?.[h] || 0;
            if (count > 0) {
              activeStudentCount++;
              hTotal += count;
            }
          });

          workoutsList.forEach((w: any) => {
            const d = new Date(w.timestamp);
            if (!isNaN(d.getTime()) && d.getHours() === h) {
              if (w.success) hSuccess++;
              else hFail++;
            }
          });

          const rate = hTotal > 0 ? `${((hSuccess / hTotal) * 100).toFixed(1)}%` : '0%';

          return {
            'S.No': i + 1,
            'Hour Slot': formatHourLabel(h),
            'Total Queries': hTotal,
            'Active Students': activeStudentCount,
            'Successful Queries': hSuccess,
            'Error Queries': hFail,
            'Success Rate (%)': rate
          };
        });

        const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
        summaryWs['!cols'] = [
          { wch: 6 },
          { wch: 18 },
          { wch: 16 },
          { wch: 18 },
          { wch: 18 },
          { wch: 16 },
          { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Hourly Timeline');
      }

      const datePart = isAllDates ? 'AllDates' : reportDate;
      const timePart = reportIsAllDay ? 'FullDay' : `${reportFromTime.replace(':', '')}-${reportToTime.replace(':', '')}`;
      const fileName = `Student_Performance_${datePart}_${timePart}.xlsx`;

      XLSX.writeFile(wb, fileName);
      setShowReportModal(false);
      setStatusMsg({
        type: 'success',
        text: `Report downloaded: ${fileName} (${workoutsList.length} queries across ${sortedAll.length} students)`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to generate report: ' + (err.message || String(err)) });
    } finally {
      setReportGenerating(false);
    }
  };

  // Export all student workout queries to Excel (.xlsx) excluding admin
  const handleExportWorkoutsExcel = () => {
    const nonAdminWorkouts = allWorkouts.filter(w => String(w.rollNumber).trim().toUpperCase() !== '22KT1A4245');
    if (!nonAdminWorkouts || nonAdminWorkouts.length === 0) {
      setStatusMsg({ type: 'error', text: 'No student workout queries available to export.' });
      return;
    }

    try {
      const rows = nonAdminWorkouts.map((w, idx) => {
        const d = new Date(w.timestamp);
        return {
          'S.No': idx + 1,
          'Roll Number': w.rollNumber,
          'Query Command': w.command,
          'Status': w.success ? 'Success' : 'Error',
          'Execution Time (ms)': w.executionTime || 0,
          'Output Message / Error': w.message || (w.error ? `Error: ${w.error}` : 'OK'),
          'Timestamp': isNaN(d.getTime()) ? String(w.timestamp) : d.toLocaleString()
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 50 },
        { wch: 10 },
        { wch: 18 },
        { wch: 35 },
        { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Student Queries');

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Student_Queries_${today}.xlsx`);
      setStatusMsg({ type: 'success', text: `Exported ${nonAdminWorkouts.length} student queries to Excel!` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to export queries: ' + (err.message || String(err)) });
    }
  };

  // Advanced Multi-Filter Student Directory computations
  const directoryStudents = useMemo(() => {
    let result = [...students];

    // Presence status filter
    if (dirPresenceFilter !== 'all') {
      if (dirPresenceFilter === 'disabled') {
        result = result.filter(s => s.isDisabled);
      } else {
        result = result.filter(s => !s.isDisabled && (s.presenceStatus || 'offline') === dirPresenceFilter);
      }
    }

    // College filter
    if (dirCollegeFilter !== 'all') {
      result = result.filter(s => (s.collegeName || '').toLowerCase() === dirCollegeFilter.toLowerCase());
    }

    // Branch filter
    if (dirBranchFilter !== 'all') {
      result = result.filter(s => (s.branch || '').toLowerCase() === dirBranchFilter.toLowerCase());
    }

    // Year filter
    if (dirYearFilter !== 'all') {
      result = result.filter(s => (s.year || '').toLowerCase() === dirYearFilter.toLowerCase());
    }

    // Workout activity filter
    if (dirWorkoutFilter !== 'all') {
      if (dirWorkoutFilter === 'has_workouts') {
        result = result.filter(s => s.workout && s.workout.total > 0);
      } else if (dirWorkoutFilter === 'no_workouts') {
        result = result.filter(s => !s.workout || s.workout.total === 0);
      } else if (dirWorkoutFilter === 'high_activity') {
        result = result.filter(s => s.workout && s.workout.total >= 20);
      } else if (dirWorkoutFilter === 'has_failures') {
        result = result.filter(s => s.workout && s.workout.failed > 0);
      }
    }

    // Search query filter (roll, phone, college, branch, year, userDbName)
    if (dirSearchQuery.trim()) {
      const q = dirSearchQuery.trim().toLowerCase();
      result = result.filter(s =>
        s.rollNumber.toLowerCase().includes(q) ||
        s.mobileNumber.toLowerCase().includes(q) ||
        (s.collegeName || '').toLowerCase().includes(q) ||
        (s.branch || '').toLowerCase().includes(q) ||
        (s.year || '').toLowerCase().includes(q) ||
        s.userDbName.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (dirSortBy === 'recent_active') {
        const timeA = a.lastActiveTime ? new Date(a.lastActiveTime).getTime() : 0;
        const timeB = b.lastActiveTime ? new Date(b.lastActiveTime).getTime() : 0;
        return timeB - timeA;
      }
      if (dirSortBy === 'roll_asc') {
        return a.rollNumber.localeCompare(b.rollNumber);
      }
      if (dirSortBy === 'roll_desc') {
        return b.rollNumber.localeCompare(a.rollNumber);
      }
      if (dirSortBy === 'commands_desc') {
        const totalA = a.workout ? a.workout.total : 0;
        const totalB = b.workout ? b.workout.total : 0;
        return totalB - totalA;
      }
      if (dirSortBy === 'created_newest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [students, dirPresenceFilter, dirCollegeFilter, dirBranchFilter, dirYearFilter, dirWorkoutFilter, dirSearchQuery, dirSortBy]);

  const dirMetrics = useMemo(() => {
    let onlineCount = 0;
    let idleCount = 0;
    let offlineCount = 0;
    let disabledCount = 0;
    let totalCommands = 0;

    directoryStudents.forEach(s => {
      if (s.isDisabled) {
        disabledCount++;
      } else {
        const status = s.presenceStatus || 'offline';
        if (status === 'online') onlineCount++;
        else if (status === 'idle') idleCount++;
        else offlineCount++;
      }

      if (s.workout) {
        totalCommands += s.workout.total;
      }
    });

    return {
      total: directoryStudents.length,
      onlineCount,
      idleCount,
      offlineCount,
      disabledCount,
      totalCommands
    };
  }, [directoryStudents]);

  const totalDirPages = Math.max(1, Math.ceil(directoryStudents.length / dirPageSize));
  const dirStartIndex = (dirPage - 1) * dirPageSize;
  const dirEndIndex = Math.min(dirStartIndex + dirPageSize, directoryStudents.length);
  const paginatedDirectoryStudents = useMemo(() => {
    return directoryStudents.slice(dirStartIndex, dirEndIndex);
  }, [directoryStudents, dirStartIndex, dirEndIndex]);

  const handleExportDirectoryToExcel = () => {
    if (directoryStudents.length === 0) {
      setStatusMsg({ type: 'error', text: 'No matching students to export.' });
      return;
    }

    try {
      const dataToExport = directoryStudents.map((s, idx) => ({
        'S.No': idx + 1,
        'Roll Number': s.rollNumber,
        'Mobile Number': s.mobileNumber,
        'College Name': s.collegeName || 'N/A',
        'Branch': s.branch || 'N/A',
        'Year': s.year || 'N/A',
        'Presence Status': s.isDisabled ? 'Disabled' : (s.presenceStatus ? s.presenceStatus.toUpperCase() : 'OFFLINE'),
        'Idle Minutes': s.idleMinutes || 0,
        'Total Commands': s.workout?.total || 0,
        'Successful Commands': s.workout?.success || 0,
        'Failed Commands': s.workout?.failed || 0,
        'Last Workout Time': s.workout?.lastWorkoutTime ? new Date(s.workout.lastWorkoutTime).toLocaleString() : 'N/A',
        'Last Active Time': s.lastActiveTime ? new Date(s.lastActiveTime).toLocaleString() : 'N/A',
        'Atlas Sandbox DB': s.userDbName,
        'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students_Directory');
      const fileName = `Student_Directory_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      setStatusMsg({ type: 'success', text: `Exported ${directoryStudents.length} student records to Excel!` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to export directory: ' + (err.message || String(err)) });
    }
  };

  const handleAddCollege = () => {
    if (!newCollege.trim()) return;
    const updated = { ...options, colleges: [...options.colleges, newCollege.trim()] };
    saveOptions(updated);
    setNewCollege('');
  };

  const handleAddBranch = () => {
    if (!newBranch.trim()) return;
    const updated = { ...options, branches: [...options.branches, newBranch.trim()] };
    saveOptions(updated);
    setNewBranch('');
  };

  const handleAddYear = () => {
    if (!newYear.trim()) return;
    const updated = { ...options, years: [...options.years, newYear.trim()] };
    saveOptions(updated);
    setNewYear('');
  };

  const handleConfirmDeleteOption = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'college') {
      const updated = { ...options, colleges: options.colleges.filter(c => c !== deleteTarget.name) };
      saveOptions(updated);
    } else if (deleteTarget.type === 'branch') {
      const updated = { ...options, branches: options.branches.filter(b => b !== deleteTarget.name) };
      saveOptions(updated);
    } else if (deleteTarget.type === 'year') {
      const updated = { ...options, years: options.years.filter(y => y !== deleteTarget.name) };
      saveOptions(updated);
    }

    setDeleteTarget(null);
  };

  // Run Admin MongoDB Command Execution
  const executeAdminCommandNow = useCallback(async (cmd: string) => {
    if (!token) return;
    setAdminExecLoading(true);
    setAdminExecResult(null);

    try {
      const res = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ command: cmd, targetDb: adminDbName })
      });
      const data: ExecutionResult = await res.json();
      setAdminExecResult(data);
    } catch (err: any) {
      setAdminExecResult({
        success: false,
        error: 'Network error: ' + (err.message || String(err)),
        executionTime: 0
      });
    } finally {
      setAdminExecLoading(false);
    }
  }, [token, adminDbName]);

  const handleRunAdminCommand = useCallback(() => {
    const lines = adminCommand.split('\n').filter(l => !l.trim().startsWith('//'));
    const cmd = lines.join('\n').trim();
    if (!cmd) return;

    const lowerCmd = cmd.toLowerCase();
    if (lowerCmd.includes('delete') || lowerCmd.includes('drop') || lowerCmd.includes('dropdatabase')) {
      setPendingDeleteCmd(cmd);
      return;
    }

    executeAdminCommandNow(cmd);
  }, [adminCommand, executeAdminCommandNow]);

  const handleConfirmExecuteDeleteCmd = useCallback(() => {
    if (pendingDeleteCmd) {
      const cmd = pendingDeleteCmd;
      setPendingDeleteCmd(null);
      executeAdminCommandNow(cmd);
    }
  }, [pendingDeleteCmd, executeAdminCommandNow]);

  return (
    <div className="admin-portal-container">
      <div className="admin-header-bar">
        <div>
          <h2>👑 Admin Management Portal</h2>
          <p>Logged in as Admin (<strong>22KT1A4245</strong>)</p>
        </div>
        <button className="btn-try" onClick={onGoToPlayground}>
          Open Fullscreen Playground →
        </button>
      </div>

      {statusMsg && (
        <div className={`admin-alert ${statusMsg.type}`}>
          <span>{statusMsg.text}</span>
          <button
            type="button"
            className="alert-close-btn"
            onClick={() => setStatusMsg(null)}
            title="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'options' ? 'active' : ''}`}
          onClick={() => setActiveTab('options')}
        >
          🏢 Dropdown Options
        </button>
        <button
          className={`admin-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Registered Students ({students.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          🔍 Advanced Directory &amp; Filters ({directoryStudents.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'workouts' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('workouts');
            fetchWorkouts(workoutFilterRoll, allWorkouts.length > 0);
          }}
        >
          🏋️ Student Workouts (Live Feed)
        </button>
        <button
          className={`admin-tab ${activeTab === 'playground' ? 'active' : ''}`}
          onClick={() => setActiveTab('playground')}
        >
          💻 MongoDB Command Stage
        </button>
      </div>

      {activeTab === 'options' ? (
        <div className="admin-grid">
          {/* Colleges */}
          <div className="admin-card">
            <h3>🏫 College Names</h3>
            <div className="admin-input-group">
              <input
                type="text"
                placeholder="Add new college name (Press Enter)..."
                value={newCollege}
                onChange={e => setNewCollege(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCollege(); }}
              />
              <button onClick={handleAddCollege}>Add</button>
            </div>
            <ul className="admin-tag-list">
              {options.colleges.map(c => (
                <li key={c} className="admin-tag">
                  <span>{c}</span>
                  <button
                    onClick={() => setDeleteTarget({ type: 'college', name: c })}
                    title={`Delete ${c}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            {options.colleges.length === 1 && (
              <div className="college-sync-banner" style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Official Active College: <strong style={{ color: 'var(--accent)' }}>{options.colleges[0]}</strong>
                </div>
                <button
                  type="button"
                  className="btn-admin-table-action"
                  onClick={handleSyncAllStudentsCollege}
                  disabled={syncLoading}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '11px' }}
                  title="Update all registered students in the database to this college"
                >
                  {syncLoading ? 'Syncing...' : `🔄 Sync All Students to ${options.colleges[0].split(',')[0]}`}
                </button>
              </div>
            )}
          </div>

          {/* Branches */}
          <div className="admin-card">
            <h3>🎓 Engineering Branches</h3>
            <div className="admin-input-group">
              <input
                type="text"
                placeholder="Add new branch (Press Enter)..."
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddBranch(); }}
              />
              <button onClick={handleAddBranch}>Add</button>
            </div>
            <ul className="admin-tag-list">
              {options.branches.map(b => (
                <li key={b} className="admin-tag">
                  <span>{b}</span>
                  <button
                    onClick={() => setDeleteTarget({ type: 'branch', name: b })}
                    title={`Delete ${b}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Years */}
          <div className="admin-card">
            <h3>📅 Academic Years</h3>
            <div className="admin-input-group">
              <input
                type="text"
                placeholder="Add new academic year (Press Enter)..."
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddYear(); }}
              />
              <button onClick={handleAddYear}>Add</button>
            </div>
            <ul className="admin-tag-list">
              {options.years.map(y => (
                <li key={y} className="admin-tag">
                  <span>{y}</span>
                  <button
                    onClick={() => setDeleteTarget({ type: 'year', name: y })}
                    title={`Delete ${y}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : activeTab === 'students' ? (
        <div className="admin-students-section">
          {/* Real-Time Student Activity Stats Banner - Clickable Quick Filters */}
          <div className="admin-presence-stats-grid">
            <button
              type="button"
              className={`presence-stat-card total ${studentPresenceFilter === 'all' ? 'active-filter' : ''}`}
              onClick={() => setStudentPresenceFilter('all')}
              title="View all registered students"
            >
              <div className="stat-card-icon">👥</div>
              <div className="stat-card-info">
                <span className="stat-card-label">Total Registered</span>
                <span className="stat-card-value">{students.length}</span>
              </div>
            </button>

            <button
              type="button"
              className={`presence-stat-card online ${studentPresenceFilter === 'online' ? 'active-filter' : ''}`}
              onClick={() => setStudentPresenceFilter(prev => prev === 'online' ? 'all' : 'online')}
              title="Click to filter active online students"
            >
              <div className="stat-card-icon">
                <span className="live-pulse-dot" />
              </div>
              <div className="stat-card-info">
                <span className="stat-card-label">Online (Active)</span>
                <span className="stat-card-value">{students.filter(s => s.presenceStatus === 'online').length}</span>
              </div>
            </button>

            <button
              type="button"
              className={`presence-stat-card idle ${studentPresenceFilter === 'idle' ? 'active-filter' : ''}`}
              onClick={() => setStudentPresenceFilter(prev => prev === 'idle' ? 'all' : 'idle')}
              title="Click to filter constant state students (idle > 5 mins)"
            >
              <div className="stat-card-icon">⏳</div>
              <div className="stat-card-info">
                <span className="stat-card-label">Constant State (&gt;5m)</span>
                <span className="stat-card-value">{students.filter(s => s.presenceStatus === 'idle').length}</span>
              </div>
            </button>

            <button
              type="button"
              className={`presence-stat-card offline ${studentPresenceFilter === 'offline' ? 'active-filter' : ''}`}
              onClick={() => setStudentPresenceFilter(prev => prev === 'offline' ? 'all' : 'offline')}
              title="Click to filter offline students"
            >
              <div className="stat-card-icon">⚪</div>
              <div className="stat-card-info">
                <span className="stat-card-label">Offline</span>
                <span className="stat-card-value">{students.filter(s => s.presenceStatus === 'offline').length}</span>
              </div>
            </button>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-card-header">
              <div className="admin-table-title-area">
                <h3>
                  👥 Registered Students ({filteredStudents.length}
                  {filteredStudents.length !== students.length ? ` of ${students.length}` : ''})
                </h3>
                {studentPresenceFilter !== 'all' && (
                  <span className="filter-active-pill">
                    Filter: <strong>{studentPresenceFilter.toUpperCase()}</strong>
                    <button type="button" onClick={() => setStudentPresenceFilter('all')}>×</button>
                  </span>
                )}
              </div>

              <div className="admin-table-header-actions">
                <div className="table-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search roll, phone, branch..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                  {studentSearch && (
                    <button
                      type="button"
                      className="btn-clear-search"
                      onClick={() => setStudentSearch('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-admin-reset-pwd"
                  onClick={() => handleOpenPasswordResetModal()}
                  title="Change student password by roll number (Zero Data Loss)"
                >
                  🔑 Change User Password
                </button>

                <button
                  type="button"
                  className="btn-admin-export"
                  onClick={handleOpenReportModal}
                  title="Generate custom student performance report with date range, time-to-time window, and hourly performance breakdown"
                >
                  📊 Generate Performance Report
                </button>

                <button
                  type="button"
                  className="btn-admin-refresh"
                  onClick={fetchStudents}
                  title="Refresh Presence Now"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Mobile Number</th>
                    <th>College Name</th>
                    <th>Branch / Year</th>
                    <th>Live Presence</th>
                    <th>🏋️ Workout Activity</th>
                    <th>Account</th>
                    <th>Atlas Sandbox DB</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '15px', marginBottom: '8px' }}>🔍 No students found matching your criteria.</div>
                        <button
                          type="button"
                          className="btn-admin-table-action"
                          style={{ padding: '6px 16px', fontSize: '12px', marginTop: '6px' }}
                          onClick={() => { setStudentSearch(''); setStudentPresenceFilter('all'); }}
                        >
                          Reset Filters &amp; Search
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(s => {
                    const status = s.presenceStatus || 'offline';
                    const hasWorkout = s.workout && s.workout.total > 0;
                    return (
                      <tr key={s._id} className={`${s.isDisabled ? 'row-student-disabled' : ''} row-presence-${status}`}>
                        <td><strong>{s.rollNumber}</strong></td>
                        <td>{s.mobileNumber}</td>
                        <td>{s.collegeName || 'N/A'}</td>
                        <td>
                          <div className="student-branch-year">
                            <span className="badge-branch">{s.branch || 'N/A'}</span>
                            <span className="badge-year">{s.year || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          {status === 'online' ? (
                            <span className="badge-presence online" title="Active now: interacting with mouse/keyboard/queries">
                              <span className="presence-dot online" />
                              Active Now
                            </span>
                          ) : status === 'idle' ? (
                            <span className="badge-presence idle" title="Constant state: connected but no mouse movement or queries for 5+ minutes">
                              <span className="presence-dot idle" />
                              Constant State ({s.idleMinutes || 5}m idle)
                            </span>
                          ) : (
                            <span className="badge-presence offline" title="Offline: disconnected or tab closed">
                              <span className="presence-dot offline" />
                              Offline
                            </span>
                          )}
                        </td>
                        <td>
                          {hasWorkout ? (
                            <div className="student-workout-cell">
                              <div className="workout-summary-badge active">
                                <strong>{s.workout!.total}</strong> command{s.workout!.total !== 1 ? 's' : ''}
                              </div>
                              <div className="workout-mini-stats">
                                <span className="mini-success">✓ {s.workout!.success}</span>
                                <span className="mini-fail">✗ {s.workout!.failed}</span>
                                {s.workout!.lastWorkoutTime && (
                                  <span className="mini-time">• {formatTimeAgo(s.workout!.lastWorkoutTime)}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="workout-summary-badge empty">
                              ○ No commands run
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge-status ${s.isDisabled ? 'disabled' : 'active'}`}>
                            {s.isDisabled ? '🚫 Disabled' : '● Active'}
                          </span>
                        </td>
                        <td><code>{s.userDbName}</code></td>
                        <td>
                          <div className="admin-table-action-group">
                            <button
                              type="button"
                              className="btn-student-history"
                              onClick={() => handleViewStudentHistory(s)}
                              title={`View full workout command history for ${s.rollNumber}`}
                            >
                              📜 History ({s.workout?.total || 0})
                            </button>
                            <button
                              type="button"
                              className="btn-student-password"
                              onClick={() => handleOpenPasswordResetModal(s.rollNumber)}
                              title={`Change password for student ${s.rollNumber} with zero data loss`}
                            >
                              🔑 Reset Pass
                            </button>
                            <button
                              type="button"
                              className={`btn-student-toggle ${s.isDisabled ? 'enable' : 'disable'}`}
                              onClick={() => handleToggleStudentStatus(s)}
                              disabled={actionLoadingId === s._id}
                              title={s.isDisabled ? 'Enable student account' : 'Disable student account'}
                            >
                              {s.isDisabled ? '✓ Enable' : '🚫 Disable'}
                            </button>
                            <button
                              type="button"
                              className="btn-student-delete"
                              onClick={() => setStudentToDelete(s)}
                              disabled={actionLoadingId === s._id}
                              title="Remove student permanently"
                            >
                              🗑️ Remove
                            </button>
                            <button
                              type="button"
                              className="btn-admin-table-action"
                              onClick={() => {
                                setAdminDbName(s.userDbName);
                                setAdminCommand(`// Query database for ${s.rollNumber}:\nshow collections`);
                                setActiveTab('playground');
                              }}
                            >
                              Inspect DB →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'directory' ? (
        /* TAB: Advanced Multi-Filter Student Directory */
        <div className="admin-directory-section">
          {/* Top Summary Metrics Header Bar */}
          <div className="directory-metrics-bar">
            <div className="metric-card total">
              <span className="metric-value">{dirMetrics.total}</span>
              <span className="metric-label">👥 Matching Students</span>
            </div>
            <div className="metric-card online">
              <span className="metric-value">🟢 {dirMetrics.onlineCount}</span>
              <span className="metric-label">Active Now</span>
            </div>
            <div className="metric-card idle">
              <span className="metric-value">🟠 {dirMetrics.idleCount}</span>
              <span className="metric-label">Constant State</span>
            </div>
            <div className="metric-card offline">
              <span className="metric-value">⚪ {dirMetrics.offlineCount}</span>
              <span className="metric-label">Offline</span>
            </div>
            <div className="metric-card disabled">
              <span className="metric-value">🚫 {dirMetrics.disabledCount}</span>
              <span className="metric-label">Disabled</span>
            </div>
            <div className="metric-card workout">
              <span className="metric-value">🏋️ {dirMetrics.totalCommands}</span>
              <span className="metric-label">Executed Commands</span>
            </div>
          </div>

          {/* Multi-Filter Controls Toolbar */}
          <div className="directory-filter-card">
            <div className="directory-filter-row">
              <div className="filter-group">
                <label>Presence Status:</label>
                <select
                  value={dirPresenceFilter}
                  onChange={e => { setDirPresenceFilter(e.target.value as any); setDirPage(1); }}
                  className="dir-select-input"
                >
                  <option value="all">All Presence States</option>
                  <option value="online">🟢 Active Now (Online)</option>
                  <option value="idle">🟠 Constant State (Idle)</option>
                  <option value="offline">⚪ Offline</option>
                  <option value="disabled">🚫 Disabled Accounts</option>
                </select>
              </div>

              <div className="filter-group">
                <label>College Name:</label>
                <select
                  value={dirCollegeFilter}
                  onChange={e => { setDirCollegeFilter(e.target.value); setDirPage(1); }}
                  className="dir-select-input"
                >
                  <option value="all">All Colleges</option>
                  {options.colleges.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Branch:</label>
                <select
                  value={dirBranchFilter}
                  onChange={e => { setDirBranchFilter(e.target.value); setDirPage(1); }}
                  className="dir-select-input"
                >
                  <option value="all">All Branches</option>
                  {options.branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Year:</label>
                <select
                  value={dirYearFilter}
                  onChange={e => { setDirYearFilter(e.target.value); setDirPage(1); }}
                  className="dir-select-input"
                >
                  <option value="all">All Years</option>
                  {options.years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Workout Activity:</label>
                <select
                  value={dirWorkoutFilter}
                  onChange={e => { setDirWorkoutFilter(e.target.value as any); setDirPage(1); }}
                  className="dir-select-input"
                >
                  <option value="all">All Activity Levels</option>
                  <option value="has_workouts">🏋️ Has Workouts (&gt;0)</option>
                  <option value="no_workouts">⭕ No Workouts (0)</option>
                  <option value="high_activity">🔥 High Activity (&ge;20)</option>
                  <option value="has_failures">❌ Has Failed Commands</option>
                </select>
              </div>
            </div>

            <div className="directory-filter-row second-row">
              <div className="filter-group search-flex">
                <label>Search Query:</label>
                <div className="table-search-box dir-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search roll, phone, college, branch, DB..."
                    value={dirSearchQuery}
                    onChange={e => { setDirSearchQuery(e.target.value); setDirPage(1); }}
                  />
                  {dirSearchQuery && (
                    <button type="button" className="btn-clear-search" onClick={() => setDirSearchQuery('')}>×</button>
                  )}
                </div>
              </div>

              <div className="filter-group">
                <label>Sort By:</label>
                <select
                  value={dirSortBy}
                  onChange={e => setDirSortBy(e.target.value as any)}
                  className="dir-select-input"
                >
                  <option value="recent_active">⏱️ Most Recently Active</option>
                  <option value="roll_asc">🔤 Roll Number (A → Z)</option>
                  <option value="roll_desc">🔤 Roll Number (Z → A)</option>
                  <option value="commands_desc">🏋️ Most Commands Executed</option>
                  <option value="created_newest">🆕 Account Creation (Newest First)</option>
                </select>
              </div>

              <div className="filter-actions-group">
                <button
                  type="button"
                  className="btn-reset-filters"
                  onClick={() => {
                    setDirPresenceFilter('all');
                    setDirCollegeFilter('all');
                    setDirBranchFilter('all');
                    setDirYearFilter('all');
                    setDirWorkoutFilter('all');
                    setDirSearchQuery('');
                    setDirSortBy('recent_active');
                    setDirPage(1);
                  }}
                  title="Reset all filters"
                >
                  🔄 Reset Filters
                </button>

                <button
                  type="button"
                  className="btn-export-excel"
                  onClick={handleExportDirectoryToExcel}
                  disabled={directoryStudents.length === 0}
                  title="Export currently filtered students list to Microsoft Excel (.xlsx)"
                >
                  📥 Export Excel ({directoryStudents.length})
                </button>
              </div>
            </div>
          </div>

          {/* Directory Student Table & Pagination */}
          <div className="admin-table-card">
            <div className="admin-table-card-header">
              <div className="admin-table-title-area">
                <h3>
                  👥 Directory Results ({directoryStudents.length} student{directoryStudents.length !== 1 ? 's' : ''})
                </h3>
              </div>
              <div className="gmail-pagination-controls">
                <span className="pagination-info">
                  Showing {directoryStudents.length === 0 ? 0 : dirStartIndex + 1}–{dirEndIndex} of {directoryStudents.length}
                </span>

                <div className="pagination-nav-group">
                  <button
                    type="button"
                    className="btn-page-nav"
                    disabled={dirPage <= 1}
                    onClick={() => setDirPage(1)}
                    title="First Page"
                  >
                    ⇤
                  </button>
                  <button
                    type="button"
                    className="btn-page-nav"
                    disabled={dirPage <= 1}
                    onClick={() => setDirPage(prev => Math.max(1, prev - 1))}
                    title="Previous Page"
                  >
                    ◄
                  </button>
                  <span className="page-current-display">Page {dirPage} of {totalDirPages}</span>
                  <button
                    type="button"
                    className="btn-page-nav"
                    disabled={dirPage >= totalDirPages}
                    onClick={() => setDirPage(prev => Math.min(totalDirPages, prev + 1))}
                    title="Next Page"
                  >
                    ►
                  </button>
                  <button
                    type="button"
                    className="btn-page-nav"
                    disabled={dirPage >= totalDirPages}
                    onClick={() => setDirPage(totalDirPages)}
                    title="Last Page"
                  >
                    ⇥
                  </button>
                </div>

                <div className="pagination-size-selector">
                  <label>Per page:</label>
                  <select
                    value={dirPageSize}
                    onChange={e => {
                      setDirPageSize(Number(e.target.value));
                      setDirPage(1);
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Mobile Number</th>
                    <th>College Name</th>
                    <th>Branch / Year</th>
                    <th>Live Presence</th>
                    <th>🏋️ Workout Activity</th>
                    <th>Account</th>
                    <th>Atlas Sandbox DB</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDirectoryStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '16px', marginBottom: '8px' }}>🔍 No students match the selected filter criteria.</div>
                        <button
                          type="button"
                          className="btn-admin-table-action"
                          style={{ padding: '6px 16px', fontSize: '12px' }}
                          onClick={() => {
                            setDirPresenceFilter('all');
                            setDirCollegeFilter('all');
                            setDirBranchFilter('all');
                            setDirYearFilter('all');
                            setDirWorkoutFilter('all');
                            setDirSearchQuery('');
                            setDirPage(1);
                          }}
                        >
                          Clear All Directory Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginatedDirectoryStudents.map(s => {
                      const status = s.presenceStatus || 'offline';
                      const hasWorkout = s.workout && s.workout.total > 0;
                      return (
                        <tr key={s._id} className={`${s.isDisabled ? 'row-student-disabled' : ''} row-presence-${status}`}>
                          <td><strong>{s.rollNumber}</strong></td>
                          <td>{s.mobileNumber}</td>
                          <td>{s.collegeName || 'N/A'}</td>
                          <td>
                            <div className="student-branch-year">
                              <span className="badge-branch">{s.branch || 'N/A'}</span>
                              <span className="badge-year">{s.year || 'N/A'}</span>
                            </div>
                          </td>
                          <td>
                            {status === 'online' ? (
                              <span className="badge-presence online" title="Active now: executing queries or mouse/keyboard active">
                                <span className="presence-dot online" />
                                Active Now
                              </span>
                            ) : status === 'idle' ? (
                              <span className="badge-presence idle" title="Constant state: connected but idle">
                                <span className="presence-dot idle" />
                                Constant State ({s.idleMinutes || 5}m idle)
                              </span>
                            ) : (
                              <span className="badge-presence offline" title="Offline: disconnected">
                                <span className="presence-dot offline" />
                                Offline
                              </span>
                            )}
                          </td>
                          <td>
                            {hasWorkout ? (
                              <div className="student-workout-cell">
                                <div className="workout-summary-badge active">
                                  <strong>{s.workout!.total}</strong> command{s.workout!.total !== 1 ? 's' : ''}
                                </div>
                                <div className="workout-mini-stats">
                                  <span className="mini-success">✓ {s.workout!.success}</span>
                                  <span className="mini-fail">✗ {s.workout!.failed}</span>
                                  {s.workout!.lastWorkoutTime && (
                                    <span className="mini-time">• {formatTimeAgo(s.workout!.lastWorkoutTime)}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="workout-summary-badge empty">
                                ○ No commands run
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge-status ${s.isDisabled ? 'disabled' : 'active'}`}>
                              {s.isDisabled ? '🚫 Disabled' : '● Active'}
                            </span>
                          </td>
                          <td><code>{s.userDbName}</code></td>
                          <td>
                            <div className="admin-table-action-group">
                              <button
                                type="button"
                                className="btn-student-password"
                                onClick={() => handleOpenPasswordResetModal(s.rollNumber)}
                                title={`Change password for student ${s.rollNumber} with zero data loss`}
                              >
                                🔑 Reset Pass
                              </button>
                              <button
                                type="button"
                                className="btn-student-history"
                                onClick={() => handleViewStudentHistory(s)}
                                title={`View full workout history for ${s.rollNumber}`}
                              >
                                📜 History ({s.workout?.total || 0})
                              </button>
                              <button
                                type="button"
                                className={`btn-student-toggle ${s.isDisabled ? 'enable' : 'disable'}`}
                                onClick={() => handleToggleStudentStatus(s)}
                                disabled={actionLoadingId === s._id}
                                title={s.isDisabled ? 'Enable student account' : 'Disable student account'}
                              >
                                {s.isDisabled ? '✓ Enable' : '🚫 Disable'}
                              </button>
                              <button
                                type="button"
                                className="btn-student-delete"
                                onClick={() => setStudentToDelete(s)}
                                disabled={actionLoadingId === s._id}
                                title="Remove student permanently"
                              >
                                🗑️ Remove
                              </button>
                              <button
                                type="button"
                                className="btn-admin-table-action"
                                onClick={() => {
                                  setAdminDbName(s.userDbName);
                                  setAdminCommand(`// Query database for ${s.rollNumber}:\nshow collections`);
                                  setActiveTab('playground');
                                }}
                              >
                                Inspect DB →
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'workouts' ? (
        /* TAB 3: Dedicated Real-Time Student Workouts Feed */
        <div className="admin-workouts-feed-section">
          <div className="admin-workouts-toolbar-card">
            <div className="workouts-toolbar-header">
              <div className="workouts-toolbar-title">
                <h3>🏋️ Real-Time Student Workout Stream</h3>
                <p>Live chronological feed of all MongoDB commands executed across student sandboxes</p>
              </div>
              <div className="workouts-toolbar-actions">
                <span className="live-refresh-note">
                  <span className="live-ping-small" /> Live Stream (auto-refresh 8s)
                </span>
                <button
                  type="button"
                  className="btn-admin-export"
                  onClick={handleExportWorkoutsExcel}
                  title="Export all queries in Excel format (.xlsx)"
                >
                  📥 Export Queries (.xlsx)
                </button>
                <button
                  type="button"
                  className="btn-admin-refresh"
                  onClick={() => fetchWorkouts(workoutFilterRoll, false, workoutLimit)}
                  title="Refresh Workouts Now"
                >
                  🔄 Refresh Feed
                </button>
              </div>
            </div>

            <div className="workouts-filter-row">
              <div className="workouts-filter-group">
                <label>Filter by Student:</label>
                <select
                  value={workoutFilterRoll}
                  onChange={e => {
                    const roll = e.target.value;
                    setWorkoutFilterRoll(roll);
                    fetchWorkouts(roll, false, workoutLimit);
                  }}
                  className="admin-select-filter"
                >
                  <option value="all">👥 All Students ({allWorkouts.length} queries)</option>
                  {students.map(s => {
                    const cName = (options.colleges.length === 1 && (!s.collegeName || s.collegeName === 'PBR VITS' || !options.colleges.includes(s.collegeName)))
                      ? options.colleges[0]
                      : (s.collegeName || '');
                    return (
                      <option key={s._id} value={s.rollNumber}>
                        {s.rollNumber} — {cName} ({s.workout?.total || 0} cmds)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="workouts-filter-group">
                <label>Query Limit:</label>
                <select
                  value={workoutLimit}
                  onChange={e => {
                    const newLim = e.target.value;
                    setWorkoutLimit(newLim);
                    fetchWorkouts(workoutFilterRoll, false, newLim);
                  }}
                  className="admin-select-filter"
                  title="Control how many queries are retrieved"
                >
                  <option value="all">⚡ Everything / All ({allWorkouts.length})</option>
                  <option value="1000">Latest 1,000</option>
                  <option value="500">Latest 500</option>
                  <option value="250">Latest 250</option>
                </select>
              </div>

              <div className="workouts-status-pills">
                <button
                  type="button"
                  className={`status-pill ${workoutFilterStatus === 'all' ? 'active' : ''}`}
                  onClick={() => setWorkoutFilterStatus('all')}
                >
                  All ({allWorkouts.length})
                </button>
                <button
                  type="button"
                  className={`status-pill success ${workoutFilterStatus === 'success' ? 'active' : ''}`}
                  onClick={() => setWorkoutFilterStatus('success')}
                >
                  ✓ Succeeded ({allWorkouts.filter(w => w.success).length})
                </button>
                <button
                  type="button"
                  className={`status-pill fail ${workoutFilterStatus === 'fail' ? 'active' : ''}`}
                  onClick={() => setWorkoutFilterStatus('fail')}
                >
                  ✗ Errors ({allWorkouts.filter(w => !w.success).length})
                </button>
              </div>

              <div className="workouts-search-box">
                <input
                  type="text"
                  placeholder="Search commands or collections..."
                  value={workoutSearch}
                  onChange={e => setWorkoutSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="admin-workouts-stream-card">
            <div ref={workoutsFeedTopRef} />

            {workoutsLoading && allWorkouts.length === 0 ? (
              <div className="history-modal-loading">
                <div className="loading-dots"><span /><span /><span /></div>
                <p>Loading real-time student workout stream...</p>
              </div>
            ) : allWorkouts.length === 0 ? (
              <div className="history-modal-empty">
                <p>No student workout commands recorded yet.</p>
              </div>
            ) : filteredWorkouts.length === 0 ? (
              <div className="history-modal-empty">
                <p>🔍 No queries matched your current filter or search criteria.</p>
                <button
                  type="button"
                  className="btn-admin-refresh"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setWorkoutFilterRoll('all');
                    setWorkoutFilterStatus('all');
                    setWorkoutSearch('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                {renderGmailPagination('top')}

                <div className="workouts-feed-list">
                  {paginatedWorkouts.map((item, idx) => {
                    const dt = new Date(item.timestamp);
                    const itemKey = item._id || `${workoutStartIndex + idx}`;
                    const isExpanded = !!expandedWorkoutIds[itemKey];
                    const lines = item.command.split('\n');
                    const isLong = lines.length > 4 || item.command.length > 220;
                    const previewText = isLong && !isExpanded ? lines.slice(0, 4).join('\n') + '\n...' : item.command;
                    const isCopied = workoutCopiedId === itemKey;

                    return (
                      <div key={itemKey} className={`workout-feed-item ${item.success ? 'success' : 'error'}`}>
                        <div className="workout-feed-top">
                          <div className="workout-feed-student">
                            <span className="workout-roll-badge">{item.rollNumber}</span>
                            <span className="workout-time-ago">{formatTimeAgo(item.timestamp)}</span>
                            <span className="workout-time-exact">({dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>
                          </div>

                          <div className="workout-feed-meta">
                            {item.executionTime !== undefined && (
                              <span className="workout-duration">⏱️ {item.executionTime}ms</span>
                            )}
                            {item.documentCount !== undefined && (
                              <span className="workout-doc-count">📄 {item.documentCount} doc(s)</span>
                            )}
                            <span className={`workout-status-badge ${item.success ? 'success' : 'error'}`}>
                              {item.success ? '✓ Succeeded' : '✗ Failed'}
                            </span>
                            <button
                              type="button"
                              className="btn-copy-code"
                              onClick={() => {
                                navigator.clipboard.writeText(item.command);
                                setWorkoutCopiedId(itemKey);
                                setTimeout(() => setWorkoutCopiedId(null), 1500);
                              }}
                              title="Copy command"
                            >
                              {isCopied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        <pre className="workout-code-block">{previewText}</pre>

                        {isLong && (
                          <button
                            type="button"
                            className="btn-expand-code"
                            onClick={() => setExpandedWorkoutIds(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                          >
                            {isExpanded ? '▲ Collapse command' : `▼ Show full command (${lines.length} lines)`}
                          </button>
                        )}

                        {item.message && item.success && (
                          <div className="workout-outcome-msg success">
                            ✓ {item.message}
                          </div>
                        )}

                        {item.error && (
                          <div className="workout-outcome-msg error">
                            ❌ Error: {item.error}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {renderGmailPagination('bottom')}
              </>
            )}
          </div>
        </div>
      ) : (
        /* TAB 4: Embedded Admin MongoDB Command Execution Stage */
        <div className="admin-cmd-stage">
          <div className="admin-cmd-header">
            <div className="admin-db-selector">
              <label>Target Database:</label>
              <select
                value={adminDbName}
                onChange={e => setAdminDbName(e.target.value)}
                className="admin-select-db"
              >
                <option value="user_db_22kt1a4245">user_db_22kt1a4245 (Admin Sandbox)</option>
                <option value="manideep_practice_app">manideep_practice_app (App Users)</option>
                {students.map(s => (
                  <option key={s._id} value={s.userDbName}>
                    {s.userDbName} ({s.rollNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-cmd-presets">
              <button onClick={() => setAdminCommand('show dbs')}>show dbs</button>
              <button onClick={() => setAdminCommand('show collections')}>show collections</button>
              <button onClick={() => setAdminCommand('db.stats()')}>db.stats()</button>
              <button onClick={() => setAdminCommand('db.users.find()')}>db.users.find()</button>
              <button onClick={() => setAdminCommand('db.createCollection("admin_coll")')}>createCollection</button>
            </div>
          </div>

          <div className="admin-cmd-editor-grid">
            <div className="admin-editor-box">
              <div className="admin-box-header">
                <span>⌨️ MongoDB Command Shell</span>
                <button className="btn-run" onClick={handleRunAdminCommand} disabled={adminExecLoading}>
                  {adminExecLoading ? 'Executing...' : '▶ Run Command'}
                </button>
              </div>
              <textarea
                className="admin-textarea-editor"
                value={adminCommand}
                onChange={e => setAdminCommand(e.target.value)}
                placeholder="Enter MongoDB command..."
                rows={10}
              />
            </div>

            <div className="admin-output-box">
              <div className="admin-box-header">
                <span>🖥️ Real-Time Output Viewer</span>
                {adminExecResult && (
                  <span className="admin-exec-time">⏱️ {adminExecResult.executionTime}ms</span>
                )}
              </div>
              <div className="admin-output-content">
                {adminExecLoading ? (
                  <div className="output-loading">
                    <div className="loading-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>Executing on MongoDB Atlas...</p>
                  </div>
                ) : !adminExecResult ? (
                  <div className="admin-output-empty">
                    Run a MongoDB command to view live results from Atlas.
                  </div>
                ) : !adminExecResult.success ? (
                  <div className="admin-output-error">
                    <strong>❌ MongoDB Execution Error:</strong>
                    <pre>{adminExecResult.error}</pre>
                  </div>
                ) : (
                  <div className="admin-output-success">
                    <div className="admin-output-banner">
                      ✓ {adminExecResult.message}
                    </div>
                    <pre className="admin-json-result">
                      {typeof adminExecResult.result === 'string'
                        ? adminExecResult.result
                        : JSON.stringify(adminExecResult.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Option Delete Confirmation Popup */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Confirm Delete Option"
        message={`Are you sure you want to delete "${deleteTarget?.name}" from student sign-up dropdowns?`}
        confirmText="Confirm Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDeleteOption}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Student Delete Confirmation Popup */}
      <ConfirmModal
        isOpen={!!studentToDelete}
        title="Confirm Remove Student"
        message={`Are you sure you want to permanently remove student "${studentToDelete?.rollNumber}" (${studentToDelete?.mobileNumber})? Their account and sandbox database will be deleted.`}
        confirmText="Confirm Remove"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDeleteStudent}
        onCancel={() => setStudentToDelete(null)}
      />

      {/* Destructive Command Execution Confirmation Popup */}
      <ConfirmModal
        isOpen={!!pendingDeleteCmd}
        title="Confirm Destructive Action"
        message={`Your command contains a delete/drop operation ("${pendingDeleteCmd}"). Are you sure you want to execute this on MongoDB Atlas?`}
        confirmText="Proceed & Execute"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmExecuteDeleteCmd}
        onCancel={() => setPendingDeleteCmd(null)}
      />

      {/* Student Password Reset Confirmation Popup */}
      <ConfirmModal
        isOpen={!!pendingPasswordReset}
        title="Confirm Password Change"
        message={`Are you sure you want to change the password for student "${pendingPasswordReset?.rollNumber}"? This will only update their login password. Their existing database sandbox, collections, and workout history will be 100% preserved with zero data loss.`}
        confirmText="Yes, Change Password"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleConfirmPasswordReset}
        onCancel={() => setPendingPasswordReset(null)}
      />

      {/* Admin Password Reset Modal */}
      {showResetPwdModal && (
        <div className="modal-overlay" onClick={() => !resetPwdLoading && setShowResetPwdModal(false)}>
          <div className="modal-card modal-reset-password" onClick={e => e.stopPropagation()}>
            <div className="modal-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Change Student Password</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Safely update user credentials with guaranteed zero data loss
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => !resetPwdLoading && setShowResetPwdModal(false)}
                disabled={resetPwdLoading}
              >
                ×
              </button>
            </div>

            <div className="zero-dataloss-badge">
              <span className="shield-icon">🛡️</span>
              <div className="zero-dataloss-text">
                <strong>Zero Data Loss Protection:</strong> Updating password modifies only credentials. All student database collections, sandbox documents, and workout history remain completely untouched.
              </div>
            </div>

            {resetPwdError && (
              <div className="admin-alert error" style={{ margin: '0 0 16px 0' }}>
                <span>{resetPwdError}</span>
              </div>
            )}

            <form onSubmit={handleInitiatePasswordReset} className="reset-pwd-form">
              <div className="form-group">
                <label htmlFor="reset-roll-input">
                  Student Roll Number <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="reset-roll-input"
                  type="text"
                  placeholder="e.g. 22KT1A4201"
                  value={resetRollNumber}
                  onChange={e => {
                    setResetRollNumber(e.target.value.toUpperCase());
                    setResetPwdError(null);
                  }}
                  disabled={resetPwdLoading}
                  list="registered-students-list"
                  autoFocus
                  required
                />
                <datalist id="registered-students-list">
                  {students.map(s => (
                    <option key={s._id} value={s.rollNumber}>
                      {s.rollNumber} - {s.collegeName || ''} ({s.branch || ''})
                    </option>
                  ))}
                </datalist>
                <span className="form-helper">Enter student roll number or select from registered students.</span>
              </div>

              <div className="form-group">
                <label htmlFor="reset-new-pass-input">
                  New Password <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="reset-new-pass-input"
                    type={showPwdVisibility ? 'text' : 'password'}
                    placeholder="Enter new password (min. 4 characters)..."
                    value={resetNewPassword}
                    onChange={e => {
                      setResetNewPassword(e.target.value);
                      setResetPwdError(null);
                    }}
                    disabled={resetPwdLoading}
                    required
                  />
                  <button
                    type="button"
                    className="btn-toggle-pwd"
                    onClick={() => setShowPwdVisibility(!showPwdVisibility)}
                    tabIndex={-1}
                    title={showPwdVisibility ? 'Hide password' : 'Show password'}
                  >
                    {showPwdVisibility ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reset-confirm-pass-input">
                  Confirm New Password <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="reset-confirm-pass-input"
                  type={showPwdVisibility ? 'text' : 'password'}
                  placeholder="Re-enter new password..."
                  value={resetConfirmPassword}
                  onChange={e => {
                    setResetConfirmPassword(e.target.value);
                    setResetPwdError(null);
                  }}
                  disabled={resetPwdLoading}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowResetPwdModal(false)}
                  disabled={resetPwdLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-run"
                  disabled={resetPwdLoading || !resetRollNumber.trim() || !resetNewPassword.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {resetPwdLoading ? 'Updating...' : 'Continue to Confirmation →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Upgraded Student Command History Inspection Modal */}
      {historyStudent && (
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="modal-card modal-student-history" onClick={e => e.stopPropagation()}>
            <div className="modal-history-header">
              <div className="modal-history-title-group">
                <h3>📜 Workout History: {historyStudent.rollNumber}</h3>
                <div className="modal-history-student-meta">
                  <span className="meta-pill">{historyStudent.collegeName || 'N/A'}</span>
                  <span className="meta-pill">{historyStudent.branch || 'N/A'}</span>
                  <span className="meta-pill">{historyStudent.year || 'N/A'}</span>
                  <span className="meta-pill">📱 {historyStudent.mobileNumber}</span>
                  <code>{historyStudent.userDbName}</code>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setHistoryStudent(null)}
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Workout Summary Metric Cards in Modal */}
            <div className="modal-workout-stats-banner">
              <div className="modal-stat-pill total">
                <span className="label">Total Commands</span>
                <span className="val">{studentHistory.length}</span>
              </div>
              <div className="modal-stat-pill success">
                <span className="label">Succeeded</span>
                <span className="val">{studentHistory.filter(h => h.success).length}</span>
              </div>
              <div className="modal-stat-pill fail">
                <span className="label">Failed</span>
                <span className="val">{studentHistory.filter(h => !h.success).length}</span>
              </div>
              {studentHistory.length > 0 && (
                <div className="modal-stat-pill rate">
                  <span className="label">Success Rate</span>
                  <span className="val">
                    {Math.round((studentHistory.filter(h => h.success).length / studentHistory.length) * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="modal-history-toolbar">
              <input
                type="text"
                className="modal-history-search"
                placeholder="Search commands executed by this student..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />

              <div className="workouts-status-pills">
                <button
                  type="button"
                  className={`status-pill ${historyFilterStatus === 'all' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterStatus('all')}
                >
                  All ({studentHistory.length})
                </button>
                <button
                  type="button"
                  className={`status-pill success ${historyFilterStatus === 'success' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterStatus('success')}
                >
                  ✓ Success ({studentHistory.filter(h => h.success).length})
                </button>
                <button
                  type="button"
                  className={`status-pill fail ${historyFilterStatus === 'fail' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterStatus('fail')}
                >
                  ✗ Errors ({studentHistory.filter(h => !h.success).length})
                </button>
              </div>
            </div>

            <div className="modal-history-body">
              {historyLoading ? (
                <div className="history-modal-loading">
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>Loading workout history for {historyStudent.rollNumber}...</p>
                </div>
              ) : studentHistory.length === 0 ? (
                <div className="history-modal-empty">
                  <p>No commands executed yet by this student.</p>
                </div>
              ) : (
                <div className="modal-history-list">
                  {studentHistory
                    .filter(item => {
                      if (historyFilterStatus === 'success' && !item.success) return false;
                      if (historyFilterStatus === 'fail' && item.success) return false;
                      if (historySearch && !item.command.toLowerCase().includes(historySearch.toLowerCase())) return false;
                      return true;
                    })
                    .map((item, idx) => {
                      const dt = new Date(item.timestamp);
                      const isExpanded = !!expandedHistoryIds[item._id || idx];
                      const lines = item.command.split('\n');
                      const isLong = lines.length > 4 || item.command.length > 220;
                      const previewText = isLong && !isExpanded ? lines.slice(0, 4).join('\n') + '\n...' : item.command;
                      const isCopied = historyCopiedId === (item._id || String(idx));

                      return (
                        <div key={item._id || idx} className={`modal-history-item ${item.success ? 'success' : 'error'}`}>
                          <div className="history-item-top">
                            <span className="history-item-time">
                              📅 {formatDayLabel(dt)} at {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <div className="history-item-badges">
                              {item.executionTime !== undefined && (
                                <span className="history-item-duration">{item.executionTime}ms</span>
                              )}
                              {item.documentCount !== undefined && (
                                <span className="history-item-doc-count">📄 {item.documentCount} doc(s)</span>
                              )}
                              <span className={`history-item-status ${item.success ? 'success' : 'error'}`}>
                                {item.success ? '✓ Succeeded' : '✗ Failed'}
                              </span>
                              <button
                                type="button"
                                className="btn-copy-code"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.command);
                                  setHistoryCopiedId(item._id || String(idx));
                                  setTimeout(() => setHistoryCopiedId(null), 1500);
                                }}
                                title="Copy command"
                              >
                                {isCopied ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <pre className="history-item-code">{previewText}</pre>

                          {isLong && (
                            <button
                              type="button"
                              className="btn-expand-code"
                              onClick={() => setExpandedHistoryIds(prev => ({ ...prev, [item._id || idx]: !prev[item._id || idx] }))}
                            >
                              {isExpanded ? '▲ Collapse command' : `▼ Show full command (${lines.length} lines)`}
                            </button>
                          )}

                          {item.message && item.success && (
                            <div className="history-item-success-msg">
                              ✓ {item.message}
                            </div>
                          )}

                          {item.error && (
                            <div className="history-item-error-msg">
                              ❌ Error: {item.error}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="modal-history-footer">
              <button
                type="button"
                className="btn-admin-table-action"
                onClick={() => {
                  setAdminDbName(historyStudent.userDbName);
                  setAdminCommand(`// Query database for ${historyStudent.rollNumber}:\nshow collections`);
                  setHistoryStudent(null);
                  setActiveTab('playground');
                }}
              >
                Inspect Database in Command Shell →
              </button>
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setHistoryStudent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Custom Student Performance Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => !reportGenerating && setShowReportModal(false)}>
          <div className="modal-card modal-report-config" onClick={e => e.stopPropagation()}>
            <div className="report-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  📊 Student Performance Report Generator
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Configure date, time-to-time window, and hourly performance breakdown for student-wise Excel report
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !reportGenerating && setShowReportModal(false)}
                disabled={reportGenerating}
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="report-modal-body">
              {/* Scope Selection */}
              <div className="report-form-group">
                <label>Report Time Scope</label>
                <div className="report-scope-toggle">
                  <button
                    type="button"
                    className={`report-scope-btn ${reportScope === 'date' ? 'active' : ''}`}
                    onClick={() => setReportScope('date')}
                  >
                    📅 Specific Date & Time Window
                  </button>
                  <button
                    type="button"
                    className={`report-scope-btn ${reportScope === 'all' ? 'active' : ''}`}
                    onClick={() => setReportScope('all')}
                  >
                    🌐 All Dates (Lifetime Performance)
                  </button>
                </div>
              </div>

              {reportScope === 'date' && (
                <>
                  {/* Date Selector */}
                  <div className="report-form-group">
                    <label>
                      <span>Select Date:</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>YYYY-MM-DD</span>
                    </label>
                    <div className="report-date-row">
                      <input
                        type="date"
                        value={reportDate}
                        onChange={e => setReportDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      <button
                        type="button"
                        className="report-quick-btn"
                        onClick={() => setReportDate(new Date().toISOString().split('T')[0])}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className="report-quick-btn"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() - 1);
                          setReportDate(d.toISOString().split('T')[0]);
                        }}
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>

                  {/* Time Window (From Time to To Time) */}
                  <div className="report-form-group">
                    <label>Time-to-Time Range</label>
                    <label className="report-checkbox-label">
                      <input
                        type="checkbox"
                        checked={reportIsAllDay}
                        onChange={e => setReportIsAllDay(e.target.checked)}
                      />
                      <span>Entire Day (00:00 to 23:59)</span>
                    </label>

                    {!reportIsAllDay && (
                      <div className="report-time-row">
                        <div className="report-time-input-wrap">
                          <span>From Time (Start):</span>
                          <input
                            type="time"
                            value={reportFromTime}
                            onChange={e => setReportFromTime(e.target.value)}
                          />
                        </div>
                        <div style={{ color: 'var(--text-tertiary)', fontWeight: 'bold', paddingTop: '18px' }}>→</div>
                        <div className="report-time-input-wrap">
                          <span>To Time (End):</span>
                          <input
                            type="time"
                            value={reportToTime}
                            onChange={e => setReportToTime(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Department / Branch Selection */}
              <div className="report-form-group">
                <label>Department / Branch Organization</label>
                <select
                  value={reportBranch}
                  onChange={e => setReportBranch(e.target.value)}
                  className="admin-select-filter"
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="all">📁 All Branches (Dedicated Sheet Tab per Branch + Master Sheet)</option>
                  {options.branches.map(b => (
                    <option key={b} value={b}>
                      📂 Only {b} Branch
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Options */}
              <div className="report-form-group">
                <label>Report Structure & Breakdown</label>
                <label className="report-checkbox-label">
                  <input
                    type="checkbox"
                    checked={reportIncludeHourly}
                    onChange={e => setReportIncludeHourly(e.target.checked)}
                  />
                  <span>Include Hourly Performance breakdown columns (Hour-by-Hour query count)</span>
                </label>
              </div>

              {/* Security & Filter Info Banner */}
              <div className="report-info-banner">
                <div>🛡️ <strong>Admin Account Filtered:</strong> Admin details (22KT1A4245) are completely excluded from student metrics.</div>
                <div>🔢 <strong>Ascending Order:</strong> All students will be sorted in ascending order of roll numbers within each branch.</div>
              </div>
            </div>

            <div className="report-modal-footer">
              <button
                type="button"
                className="btn-report-cancel"
                onClick={() => setShowReportModal(false)}
                disabled={reportGenerating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-report-submit"
                onClick={handleGenerateCustomReport}
                disabled={reportGenerating}
              >
                {reportGenerating ? '⏳ Generating Excel...' : '📥 Download Excel Sheet (.xlsx)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
