export interface User {
  rollNumber: string;
  mobileNumber: string;
  collegeName: string;
  branch: string;
  year: string;
  isAdmin?: boolean;
  userDbName: string;
}

export interface DropdownOptions {
  colleges: string[];
  branches: string[];
  years: string[];
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  message?: string;
  documentCount?: number;
  executionTime: number;
  validation?: {
    correct: boolean;
    message: string;
  } | null;
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  success: boolean;
}

export interface CollectionInfo {
  name: string;
  count: number;
}

export interface Lesson {
  id: number;
  title: string;
  concept: string;
  syntax: string;
  example: string;
  expectedOutput: string;
  exercise: string;
  hint: string;
  solution: string;
  validationQuery: string;
  defaultEditorContent: string;
}
