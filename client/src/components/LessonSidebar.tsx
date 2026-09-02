import { Lesson } from '../types';

interface LessonSidebarProps {
  lessons: Lesson[];
  activeLesson: number;
  onSelectLesson: (id: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LessonSidebar({ lessons, activeLesson, onSelectLesson, collapsed, onToggleCollapse }: LessonSidebarProps) {
  return (
    <aside className={`lesson-sidebar ${collapsed ? 'collapsed' : ''}`} id="lesson-sidebar">
      <button className="sidebar-toggle" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? (
            <polyline points="9 18 15 12 9 6" />
          ) : (
            <polyline points="15 18 9 12 15 6" />
          )}
        </svg>
      </button>
      {!collapsed && (
        <>
          <div className="sidebar-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>Lessons</span>
          </div>
          <nav className="sidebar-nav">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                className={`sidebar-item ${activeLesson === lesson.id ? 'active' : ''}`}
                onClick={() => onSelectLesson(lesson.id)}
                id={`lesson-${lesson.id}`}
              >
                <span className="sidebar-item-number">{lesson.id}</span>
                <span className="sidebar-item-title">{lesson.title}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}
