import { useState, useMemo } from 'react';
import { CommandHistoryEntry } from '../types';

interface CommandHistoryProps {
  history: CommandHistoryEntry[];
  onCommandClick: (command: string) => void;
}

function parseDate(ts: Date | string): Date {
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function formatDayHeader(date: Date): string {
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

function getDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function CommandHistory({ history, onCommandClick }: CommandHistoryProps) {
  const [search, setSearch] = useState('');

  // Group items by day
  const dayGroups = useMemo(() => {
    const filtered = history.filter(entry =>
      search ? entry.command.toLowerCase().includes(search.toLowerCase()) : true
    );

    // Map by YYYY-MM-DD
    const groups: { [key: string]: { dayLabel: string; date: Date; items: CommandHistoryEntry[] } } = {};

    filtered.forEach(entry => {
      const d = parseDate(entry.timestamp);
      const key = getDayKey(d);
      if (!groups[key]) {
        groups[key] = {
          dayLabel: formatDayHeader(d),
          date: d,
          items: [],
        };
      }
      groups[key].items.push(entry);
    });

    // Sort group keys descending (latest day first)
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(key => ({
      key,
      ...groups[key]
    }));
  }, [history, search]);

  return (
    <div className="command-history" id="command-history">
      <div className="history-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>Command History</span>
        <span className="history-count">{history.length}</span>
      </div>

      {history.length > 0 && (
        <div className="history-search-container">
          <input
            type="text"
            className="history-search-input"
            placeholder="Search history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="history-search-clear" onClick={() => setSearch('')} title="Clear search">
              ×
            </button>
          )}
        </div>
      )}

      {history.length === 0 ? (
        <div className="history-empty">
          <p>No commands executed yet.</p>
        </div>
      ) : dayGroups.length === 0 ? (
        <div className="history-empty">
          <p>No matching commands found.</p>
        </div>
      ) : (
        <div className="history-list">
          {dayGroups.map((group) => (
            <div key={group.key} className="history-day-group">
              <div className="history-day-header">
                <span className="history-day-title">📅 {group.dayLabel}</span>
                <span className="history-day-badge">{group.items.length} {group.items.length === 1 ? 'cmd' : 'cmds'}</span>
              </div>
              <div className="history-day-items">
                {group.items.map((entry) => {
                  const d = parseDate(entry.timestamp);
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <button
                      key={entry.id}
                      className={`history-item ${entry.success ? 'success' : 'error'}`}
                      onClick={() => onCommandClick(entry.command)}
                      title={`Click to load into editor\nExecuted: ${d.toLocaleString()}`}
                    >
                      <span className="history-time">{timeStr}</span>
                      <span className="history-command">
                        {entry.command.length > 70
                          ? entry.command.substring(0, 67) + '...'
                          : entry.command}
                      </span>
                      <span className={`history-status ${entry.success ? 'success' : 'error'}`}>
                        {entry.success ? '✓' : '✗'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
