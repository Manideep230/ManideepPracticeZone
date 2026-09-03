import { useState, useCallback } from 'react';
import { ExecutionResult, CollectionInfo, CommandHistoryEntry } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export function useMongoExecution(token: string | null) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [dbName, setDbName] = useState<string>('');

  const executeCommand = useCallback(async (command: string): Promise<ExecutionResult> => {
    if (!token) {
      const err: ExecutionResult = {
        success: false,
        error: 'Authentication required. Please sign in.',
        executionTime: 0
      };
      setResult(err);
      return err;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command }),
      });
      const data: ExecutionResult = await response.json();
      setResult(data);
      return data;
    } catch {
      const errorResult: ExecutionResult = {
        success: false,
        error: 'Failed to connect to backend server on port 3001.',
        executionTime: 0,
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCollections = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/collections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCollections(data.collections);
        if (data.dbName) setDbName(data.dbName);
      }
    } catch {
      // Silently fail
    }
  }, [token]);

  const fetchHistory = useCallback(async (): Promise<CommandHistoryEntry[]> => {
    if (!token) return [];
    try {
      const response = await fetch(`${API_BASE}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.history)) {
        return data.history.map((item: any) => ({
          id: item.id || String(Math.random()),
          command: item.command,
          timestamp: new Date(item.timestamp),
          success: !!item.success,
        }));
      }
    } catch {
      // Silently fail
    }
    return [];
  }, [token]);

  const fetchCollectionDocs = useCallback(async (name: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/collections/${name}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setResult({
          success: true,
          result: data.documents,
          message: `${data.collection}: ${data.count} document(s)`,
          documentCount: data.count,
          executionTime: 0,
        });
      }
    } catch {
      setResult({
        success: false,
        error: `Failed to fetch documents from "${name}".`,
        executionTime: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    loading,
    result,
    collections,
    dbName,
    executeCommand,
    fetchCollections,
    fetchHistory,
    fetchCollectionDocs,
    clearResult,
  };
}
