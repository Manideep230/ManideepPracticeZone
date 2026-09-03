import { useState, useEffect, useCallback } from 'react';
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
}

export function AdminPortal({ token, onGoToPlayground }: AdminPortalProps) {
  const [options, setOptions] = useState<DropdownOptions>({ colleges: [], branches: [], years: [] });
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'options' | 'students' | 'playground'>('options');
  
  // Options management form state
  const [newCollege, setNewCollege] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newYear, setNewYear] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const [adminDbName, setAdminDbName] = useState('user_db_22kt1a4245');
  const [adminCommand, setAdminCommand] = useState('show dbs');
  const [adminExecLoading, setAdminExecLoading] = useState(false);
  const [adminExecResult, setAdminExecResult] = useState<ExecutionResult | null>(null);
  const [pendingDeleteCmd, setPendingDeleteCmd] = useState<string | null>(null);

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

  const handleViewStudentHistory = async (student: Student) => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    setHistorySearch('');
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
        setStatusMsg({ type: 'success', text: 'Dropdown options saved successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save options.' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error saving options.' });
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
          {statusMsg.text}
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'options' ? 'active' : ''}`}
          onClick={() => setActiveTab('options')}
        >
          Manage Dropdown Options
        </button>
        <button
          className={`admin-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          Registered Students ({students.length})
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
                placeholder="Add new college name..."
                value={newCollege}
                onChange={e => setNewCollege(e.target.value)}
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
          </div>

          {/* Branches */}
          <div className="admin-card">
            <h3>🎓 Branches</h3>
            <div className="admin-input-group">
              <input
                type="text"
                placeholder="Add new branch (e.g. CSE)..."
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
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
                placeholder="Add new year (e.g. V Year)..."
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
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
          {/* Real-Time Student Activity Stats Banner */}
          <div className="admin-presence-stats-grid">
            <div className="presence-stat-card total">
              <div className="stat-card-icon">👥</div>
              <div className="stat-card-info">
                <span className="stat-card-label">Total Registered</span>
                <span className="stat-card-value">{students.length}</span>
              </div>
            </div>

            <div className="presence-stat-card online">
              <div className="stat-card-icon">
                <span className="live-pulse-dot" />
              </div>
              <div className="stat-card-info">
                <span className="stat-card-label">Online (Active)</span>
                <span className="stat-card-value">{students.filter(s => s.presenceStatus === 'online').length}</span>
              </div>
            </div>

            <div className="presence-stat-card idle">
              <div className="stat-card-icon">⏳</div>
              <div className="stat-card-info">
                <span className="stat-card-label">Constant State (&gt;5m)</span>
                <span className="stat-card-value">{students.filter(s => s.presenceStatus === 'idle').length}</span>
              </div>
            </div>

            <div className="presence-stat-card offline">
              <div className="stat-card-icon">⚪</div>
              <div className="stat-card-info">
                <span className="stat-card-label">Offline</span>
                <span className="stat-card-value">{students.filter(s => s.presenceStatus === 'offline').length}</span>
              </div>
            </div>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-card-header">
              <h3>👥 Registered Students & Live Activity Monitoring</h3>
              <div className="admin-table-header-actions">
                <span className="live-refresh-note">
                  <span className="live-ping-small" /> Live Monitoring (auto-refresh 12s)
                </span>
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
                    <th>Account</th>
                    <th>Atlas Sandbox DB</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const status = s.presenceStatus || 'offline';
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
                              title={`View ${s.rollNumber}'s complete command execution history`}
                            >
                              📜 History
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
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 3: Embedded Admin MongoDB Command Execution Stage */
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

      {/* Student Command History Inspection Modal */}
      {historyStudent && (
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="modal-card modal-student-history" onClick={e => e.stopPropagation()}>
            <div className="modal-history-header">
              <div className="modal-history-title-group">
                <h3>📜 Command History: {historyStudent.rollNumber}</h3>
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

            <div className="modal-history-toolbar">
              <input
                type="text"
                className="modal-history-search"
                placeholder="Search commands executed by this student..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
              <span className="modal-history-badge">
                {studentHistory.length} command{studentHistory.length !== 1 ? 's' : ''} executed
              </span>
            </div>

            <div className="modal-history-body">
              {historyLoading ? (
                <div className="history-modal-loading">
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>Loading command history for {historyStudent.rollNumber}...</p>
                </div>
              ) : studentHistory.length === 0 ? (
                <div className="history-modal-empty">
                  <p>No commands executed yet by this student.</p>
                </div>
              ) : (
                <div className="modal-history-list">
                  {studentHistory
                    .filter(item => !historySearch || item.command.toLowerCase().includes(historySearch.toLowerCase()))
                    .map((item, idx) => {
                      const dt = new Date(item.timestamp);
                      return (
                        <div key={item._id || idx} className={`modal-history-item ${item.success ? 'success' : 'error'}`}>
                          <div className="history-item-top">
                            <span className="history-item-time">
                              📅 {dt.toLocaleDateString()} at {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <div className="history-item-badges">
                              {item.executionTime !== undefined && (
                                <span className="history-item-duration">{item.executionTime}ms</span>
                              )}
                              <span className={`history-item-status ${item.success ? 'success' : 'error'}`}>
                                {item.success ? '✓ Succeeded' : '✗ Failed'}
                              </span>
                            </div>
                          </div>
                          <pre className="history-item-code">{item.command}</pre>
                          {item.error && (
                            <div className="history-item-error-msg">
                              Error: {item.error}
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
