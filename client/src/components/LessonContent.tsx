import { useState } from 'react';
import { Lesson } from '../types';

interface LessonContentProps {
  lesson: Lesson;
  onTryExample: (code: string) => void;
}

export function LessonContent({ lesson, onTryExample }: LessonContentProps) {
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Reset toggles when lesson changes
  const [lastLessonId, setLastLessonId] = useState(lesson.id);
  if (lesson.id !== lastLessonId) {
    setShowHint(false);
    setShowSolution(false);
    setLastLessonId(lesson.id);
  }

  return (
    <div className="lesson-content" id="lesson-content">
      <div className="lesson-header-badge">
        <span className="lesson-number">Lesson {lesson.id}</span>
      </div>
      <h2 className="lesson-title">{lesson.title}</h2>

      {/* Concept */}
      <section className="lesson-section">
        <h3 className="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Concept
        </h3>
        <div className="concept-text">
          {lesson.concept.split('\n').map((line, i) => {
            if (line.startsWith('•')) {
              return <li key={i} className="concept-bullet">{formatText(line.substring(1).trim())}</li>;
            }
            if (line.startsWith('**') && line.endsWith('**')) {
              return <h4 key={i} className="concept-subheading">{line.replace(/\*\*/g, '')}</h4>;
            }
            if (line.trim() === '') return <br key={i} />;
            return <p key={i}>{formatText(line)}</p>;
          })}
        </div>
      </section>

      {/* Syntax */}
      <section className="lesson-section">
        <h3 className="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Syntax
        </h3>
        <pre className="code-block">{lesson.syntax}</pre>
      </section>

      {/* Example */}
      <section className="lesson-section">
        <h3 className="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Example
        </h3>
        <pre className="code-block">{lesson.example}</pre>
      </section>

      {/* Expected Output */}
      <section className="lesson-section">
        <h3 className="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Expected Output
        </h3>
        <pre className="code-block output-block">{lesson.expectedOutput}</pre>
      </section>

      {/* Try It Yourself */}
      <section className="lesson-section try-section">
        <button
          className="btn-try"
          onClick={() => onTryExample(lesson.defaultEditorContent)}
          id="try-example"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Try It Yourself
        </button>
      </section>

      {/* Exercise */}
      <section className="lesson-section exercise-section">
        <h3 className="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Exercise
        </h3>
        <div className="exercise-prompt">{lesson.exercise}</div>
      </section>

      {/* Hint */}
      <section className="lesson-section">
        <button
          className="btn-hint"
          onClick={() => setShowHint(!showHint)}
          id="show-hint"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {showHint ? 'Hide Hint' : 'Show Hint'}
        </button>
        {showHint && (
          <div className="hint-content">{lesson.hint}</div>
        )}
      </section>

      {/* Solution */}
      <section className="lesson-section">
        <button
          className="btn-solution"
          onClick={() => setShowSolution(!showSolution)}
          id="show-solution"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </button>
        {showSolution && (
          <div className="solution-content">
            <pre className="code-block">{lesson.solution}</pre>
            <button
              className="btn-load-solution"
              onClick={() => onTryExample(lesson.solution)}
            >
              Load into Editor
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function formatText(text: string): React.ReactNode {
  // Bold text
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
