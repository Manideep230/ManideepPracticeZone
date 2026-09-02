import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { AdminPortal } from './components/AdminPortal';
import { MongoEditor } from './components/MongoEditor';
import { OutputPanel } from './components/OutputPanel';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { CommandHistory } from './components/CommandHistory';
import { ConfirmModal } from './components/ConfirmModal';
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
    fetchCollectionDocs,
  } = useMongoExecution(token);

  const [editorValue, setEditorValue] = useState(`// Create a new collection in your persistent MongoDB Atlas database:\ndb.createCollection("allu")\n\n// Or insert a document directly:\n// db.allu.insertOne({ name: "Rahul", role: "Developer" })`);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);

  // Destructive command execution confirm modal state
  const [pendingDeleteCommand, setPendingDeleteCommand] = useState<string | null>(null);

  const runCommandNow = useCallback(async (command: string) => {
    const res = await executeCommand(command);

    setCommandHistory(prev => [...prev, {
      id: Date.now().toString(),
      command,
      timestamp: new Date(),
      success: res.success,
    }]);

    fetchCollections();
  }, [executeCommand, fetchCollections]);

  const handleRun = useCallback(async () => {
    const lines = editorValue.split('\n').filter(l => !l.trim().startsWith('//'));
    const command = lines.join('\n').trim();
    if (!command) return;

    const lowerCmd = command.toLowerCase();

    // If command contains destructive operations (delete or drop), ask for popup confirmation
    if (
      lowerCmd.includes('delete') ||
      lowerCmd.includes('drop') ||
      lowerCmd.includes('dropdatabase')
    ) {
      setPendingDeleteCommand(command);
      return;
    }

    await runCommandNow(command);
  }, [editorValue, runCommandNow]);

  const handleConfirmExecuteDelete = useCallback(async () => {
    if (pendingDeleteCommand) {
      const cmd = pendingDeleteCommand;
      setPendingDeleteCommand(null);
      await runCommandNow(cmd);
    }
  }, [pendingDeleteCommand, runCommandNow]);

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

      {/* Destructive Command Delete / Drop Confirmation Modal */}
      <ConfirmModal
        isOpen={!!pendingDeleteCommand}
        title="Confirm Destructive Action"
        message={`Your command contains a delete/drop operation ("${pendingDeleteCommand}"). Are you sure you want to execute this on MongoDB Atlas?`}
        confirmText="Proceed & Execute"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmExecuteDelete}
        onCancel={() => setPendingDeleteCommand(null)}
      />
    </div>
  );
}

export default App;
