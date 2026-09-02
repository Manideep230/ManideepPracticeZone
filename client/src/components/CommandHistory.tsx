import { CommandHistoryEntry } from '../types';

interface CommandHistoryProps {
  history: CommandHistoryEntry[];
  onCommandClick: (command: string) => void;
}

export function CommandHistory({ history, onCommandClick }: CommandHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="command-history" id="command-history">
        <div className="history-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Command History</span>
        </div>
        <div className="history-empty">
          <p>No commands executed yet.</p>
        </div>
      </div>
    );
  }

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
      <div className="history-list">
        {[...history].reverse().map((entry) => (
          <button
            key={entry.id}
            className={`history-item ${entry.success ? 'success' : 'error'}`}
            onClick={() => onCommandClick(entry.command)}
            title="Click to load into editor"
          >
            <span className="history-time">
              {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="history-command">
              {entry.command.length > 60
                ? entry.command.substring(0, 57) + '...'
                : entry.command}
            </span>
            <span className={`history-status ${entry.success ? 'success' : 'error'}`}>
              {entry.success ? '✓' : '✗'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
