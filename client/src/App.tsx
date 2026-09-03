import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { AdminPortal } from './components/AdminPortal';
import { MongoEditor } from './components/MongoEditor';
import { OutputPanel } from './components/OutputPanel';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { CommandHistory } from './components/CommandHistory';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useMongoExecution } from './hooks/useMongoExecution';
import { CommandHistoryEntry } from './types';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, token, loading: authLoading, authError, options, setAuthError, signUp, signIn, signOut } = useAuth();
  const [viewMode, setViewMode] = useState<'playground' | 'admin'>('playground');

  const {
    loading: execLoading,
    result,
    collections,
    dbName,
    executeCommand,
    fetchCollections,
    fetchHistory,
    fetchCollectionDocs,
  } = useMongoExecution(token);

  const [editorValue, setEditorValue] = useState('db.createCollection("users")');
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);

  // Fetch permanent command history on sign-in
  useEffect(() => {
    if (token) {
      fetchHistory().then(hist => {
        if (hist && hist.length > 0) {
          setCommandHistory(hist);
        }
      });
    } else {
      setCommandHistory([]);
    }
  }, [token, fetchHistory]);

  const runCommandNow = useCallback(async (command: string) => {
    const res = await executeCommand(command);

    const newEntry: CommandHistoryEntry = {
      id: Date.now().toString(),
      command,
      timestamp: new Date(),
      success: res.success,
    };

    setCommandHistory(prev => [newEntry, ...prev]);

    fetchCollections();
  }, [executeCommand, fetchCollections]);

  const handleRun = useCallback(async () => {
    const lines = editorValue.split('\n').filter(l => !l.trim().startsWith('//'));
    const command = lines.join('\n').trim();
    if (!command) return;

    // Delete/drop commands execute immediately without popup confirmation
    await runCommandNow(command);
  }, [editorValue, runCommandNow]);

  const handleClear = useCallback(() => {
    setEditorValue('');
  }, []);

  const handleCommandClick = useCallback((command: string) => {
    setEditorValue(command);
  }, []);

  const handleCollectionClick = useCallback((name: string) => {
    fetchCollectionDocs(name);
    setEditorValue(`db.${name}.find()`);
  }, [fetchCollectionDocs]);

  if (authLoading) {
    return (
      <div className={`app ${theme}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="output-loading">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Connecting to Manideep Practice Zone...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${theme}`} id="app-root">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onSignOut={signOut}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(viewMode === 'admin' ? 'playground' : 'admin')}
      />

      {!user ? (
        <AuthModal
          onSignUp={signUp}
          onSignIn={signIn}
          options={options}
          error={authError}
          onErrorClear={() => setAuthError(null)}
        />
      ) : viewMode === 'admin' ? (
        <AdminPortal
          token={token}
          onGoToPlayground={() => setViewMode('playground')}
        />
      ) : (
        <div className="workspace-full">
          {/* Editor + Output */}
          <div className="editor-output-split">
            <MongoEditor
              value={editorValue}
              onChange={setEditorValue}
              onRun={handleRun}
              onClear={handleClear}
              theme={theme}
              loading={execLoading}
            />
            <OutputPanel
              result={result}
              loading={execLoading}
            />
          </div>

          {/* Bottom panels */}
          <div className="bottom-panels">
            <DatabaseExplorer
              collections={collections}
              dbName={dbName}
              onCollectionClick={handleCollectionClick}
              onRefresh={fetchCollections}
            />
            <CommandHistory
              history={commandHistory}
              onCommandClick={handleCommandClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
