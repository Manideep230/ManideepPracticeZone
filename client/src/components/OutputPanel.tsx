import { ExecutionResult } from '../types';

interface OutputPanelProps {
  result: ExecutionResult | null;
  loading: boolean;
}

export function OutputPanel({ result, loading }: OutputPanelProps) {
  if (loading) {
    return (
      <div className="output-panel" id="output-panel">
        <div className="output-toolbar">
          <span className="output-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Output
          </span>
        </div>
        <div className="output-body">
          <div className="output-loading">
            <div className="loading-dots">
              <span></span><span></span><span></span>
            </div>
            <p>Executing query...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="output-panel" id="output-panel">
        <div className="output-toolbar">
          <span className="output-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Output
          </span>
        </div>
        <div className="output-body">
          <div className="output-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <p>Run a MongoDB command to see the result here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="output-panel" id="output-panel">
      <div className="output-toolbar">
        <span className="output-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Output
        </span>
        <div className="output-meta">
          {result.success && result.documentCount !== undefined && (
            <span className="meta-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {result.documentCount} doc{result.documentCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="meta-badge time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {result.executionTime}ms
          </span>
        </div>
      </div>

      <div className="output-body">
        {/* Status message */}
        {result.success && result.message && (
          <div className="output-message success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {result.message}
          </div>
        )}

        {/* Error message */}
        {!result.success && result.error && (
          <div className="output-message error">
            <div className="error-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              MongoDB Error
            </div>
            <p>{result.error}</p>
          </div>
        )}

        {/* Validation */}
        {result.validation && (
          <div className={`output-message validation ${result.validation.correct ? 'correct' : 'incorrect'}`}>
            {result.validation.message}
          </div>
        )}

        {/* Result JSON */}
        {result.success && result.result !== null && result.result !== undefined && (
          <pre className="output-json">
            {typeof result.result === 'object'
              ? JSON.stringify(result.result, null, 2)
              : String(result.result)}
          </pre>
        )}
      </div>
    </div>
  );
}
