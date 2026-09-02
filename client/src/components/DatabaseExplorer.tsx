import { useEffect } from 'react';
import { CollectionInfo } from '../types';

interface DatabaseExplorerProps {
  collections: CollectionInfo[];
  dbName: string;
  onCollectionClick: (name: string) => void;
  onRefresh: () => void;
}

export function DatabaseExplorer({ collections, dbName, onCollectionClick, onRefresh }: DatabaseExplorerProps) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const activeDb = dbName || 'my_practice_db';

  return (
    <div className="db-explorer" id="database-explorer">
      <div className="explorer-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        <span>Database Explorer</span>
        <button className="btn-refresh" onClick={onRefresh} title="Refresh Collections">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      <div className="explorer-tree">
        <div className="tree-db">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span className="tree-db-name">{activeDb}</span>
        </div>

        {collections.length === 0 ? (
          <div className="tree-empty">
            <span>No collections yet. Create one with <code>db.createCollection("my_coll")</code></span>
          </div>
        ) : (
          collections.map((col, i) => (
            <button
              key={col.name}
              className="tree-collection"
              onClick={() => onCollectionClick(col.name)}
              id={`collection-${col.name}`}
            >
              <span className="tree-branch">
                {i === collections.length - 1 ? '└── ' : '├── '}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="tree-name">{col.name}</span>
              <span className="tree-count">{col.count}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
