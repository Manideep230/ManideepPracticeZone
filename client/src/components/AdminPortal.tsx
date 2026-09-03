import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [activeTab, setActiveTab] = useState<'options' | 'students' | 'workouts' | 'playground'>('students');
  
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

  const [adminDbName, setAdminDbName] = useState('user_db_22kt1a4245');
  const [adminCommand, setAdminCommand] = useState('show dbs');
  const [adminExecLoading, setAdminExecLoading] = useState(false);
  const [adminExecResult, setAdminExecResult] = useState<ExecutionResult | null>(null);
  const [pendingDeleteCmd, setPendingDeleteCmd] = useState<string | null>(null);

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
        if (historyStudent) setHistoryStudent(null);
        if (deleteTarget) setDeleteTarget(null);
        if (studentToDelete) setStudentToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStudent, deleteTarget, studentToDelete]);

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

  // Export student performance to Excel (.xlsx) with branch-wise sheets in ascending order of roll numbers
  const handleExportBranchWiseExcel = () => {
    if (!students || students.length === 0) {
      setStatusMsg({ type: 'error', text: 'No student records available to export.' });
      return;
    }

    try {
      const naturalRollSort = (a: Student, b: Student) => {
        return (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true, sensitivity: 'base' });
      };

      const formatStudentRow = (s: Student, idx: number) => {
        const total = s.workout?.total || 0;
        const success = s.workout?.success || 0;
        const failed = s.workout?.failed || 0;
        const successRate = total > 0 ? `${((success / total) * 100).toFixed(1)}%` : '0%';
        let lastWorkoutStr = 'No queries run';
        if (s.workout?.lastWorkoutTime) {
          const d = new Date(s.workout.lastWorkoutTime);
          lastWorkoutStr = isNaN(d.getTime()) ? String(s.workout.lastWorkoutTime) : d.toLocaleString();
        }

        return {
          'S.No': idx + 1,
          'Roll Number': s.rollNumber,
          'Mobile Number': s.mobileNumber,
          'College Name': s.collegeName || 'GMRIT College, Vizianagaram',
          'Branch': s.branch || 'General',
          'Year': s.year || 'N/A',
          'Total Commands': total,
          'Successful Queries': success,
          'Error Queries': failed,
          'Success Rate': successRate,
          'Last Activity / Workout': lastWorkoutStr,
          'Live Presence': s.presenceStatus === 'online' ? 'Active Now' : s.presenceStatus === 'idle' ? `Constant State (${s.idleMinutes || 5}m idle)` : 'Offline',
          'Account Status': s.isDisabled ? 'Disabled' : 'Active'
        };
      };

      const colsWidth = [
        { wch: 6 },   // S.No
        { wch: 18 },  // Roll Number
        { wch: 15 },  // Mobile Number
        { wch: 32 },  // College Name
        { wch: 12 },  // Branch
        { wch: 12 },  // Year
        { wch: 16 },  // Total Commands
        { wch: 18 },  // Successful Queries
        { wch: 16 },  // Error Queries
        { wch: 15 },  // Success Rate
        { wch: 24 },  // Last Activity
        { wch: 20 },  // Live Presence
        { wch: 15 }   // Account Status
      ];

      const wb = XLSX.utils.book_new();

      // Master sheet: All students sorted in ascending order of roll numbers
      const allSorted = [...students].sort(naturalRollSort);
      const allWs = XLSX.utils.json_to_sheet(allSorted.map(formatStudentRow));
      allWs['!cols'] = colsWidth;
      XLSX.utils.book_append_sheet(wb, allWs, 'All Students');

      // Individual Branch sheets (CSE, ECE, EEE, MECH, etc.), each in ascending order of roll numbers
      const branches = Array.from(new Set(students.map(s => (s.branch || 'General').trim()))).sort();
      branches.forEach(branch => {
        const branchStudents = students
          .filter(s => (s.branch || 'General').trim() === branch)
          .sort(naturalRollSort);

        if (branchStudents.length > 0) {
          const ws = XLSX.utils.json_to_sheet(branchStudents.map(formatStudentRow));
          ws['!cols'] = colsWidth;
          const cleanSheetName = branch.replace(/[:\\/?*\[\]]/g, '_').substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
        }
      });

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Student_Performance_Report_${today}.xlsx`);
      setStatusMsg({ type: 'success', text: `Downloaded Excel report with ${branches.length + 1} branch sheets!` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to generate Excel report: ' + (err.message || String(err)) });
    }
  };

  // Export all student workout queries to Excel (.xlsx)
  const handleExportWorkoutsExcel = () => {
    if (!allWorkouts || allWorkouts.length === 0) {
      setStatusMsg({ type: 'error', text: 'No workout queries available to export.' });
      return;
    }

    try {
      const rows = allWorkouts.map((w, idx) => {
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
      XLSX.utils.book_append_sheet(wb, ws, 'All Queries');

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Student_Workouts_All_${today}.xlsx`);
      setStatusMsg({ type: 'success', text: `Exported ${allWorkouts.length} workout queries to Excel!` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to export queries: ' + (err.message || String(err)) });
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
                  className="btn-admin-export"
                  onClick={handleExportBranchWiseExcel}
                  title="Download branch-wise Excel (.xlsx) with roll numbers sorted in ascending order"
                >
                  📊 Export Branch-Wise Excel
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
            {workoutsLoading && allWorkouts.length === 0 ? (
              <div className="history-modal-loading">
                <div className="loading-dots"><span /><span /><span /></div>
                <p>Loading real-time student workout stream...</p>
              </div>
            ) : allWorkouts.length === 0 ? (
              <div className="history-modal-empty">
                <p>No student workout commands recorded yet.</p>
              </div>
            ) : (
              <div className="workouts-feed-list">
                {allWorkouts
                  .filter(item => {
                    if (workoutFilterStatus === 'success' && !item.success) return false;
                    if (workoutFilterStatus === 'fail' && item.success) return false;
                    if (workoutSearch && !item.command.toLowerCase().includes(workoutSearch.toLowerCase()) && !String(item.rollNumber).toLowerCase().includes(workoutSearch.toLowerCase())) return false;
                    return true;
                  })
                  .map((item, idx) => {
                    const dt = new Date(item.timestamp);
                    const isExpanded = !!expandedWorkoutIds[item._id || idx];
                    const lines = item.command.split('\n');
                    const isLong = lines.length > 4 || item.command.length > 220;
                    const previewText = isLong && !isExpanded ? lines.slice(0, 4).join('\n') + '\n...' : item.command;
                    const isCopied = workoutCopiedId === (item._id || String(idx));

                    return (
                      <div key={item._id || idx} className={`workout-feed-item ${item.success ? 'success' : 'error'}`}>
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
                                setWorkoutCopiedId(item._id || String(idx));
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
                            onClick={() => setExpandedWorkoutIds(prev => ({ ...prev, [item._id || idx]: !prev[item._id || idx] }))}
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
    </div>
  );
}
