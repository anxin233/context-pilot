export interface Position {
  line: number;
  character: number;
}

export interface SelectionRange {
  start: Position;
  end: Position;
}

export interface VisibleRange {
  startLine: number;
  endLine: number;
}

export interface EditorState {
  filePath: string;
  workspaceFolderName?: string;
  viewColumn: number;
  cursorPosition: Position;
  selections: SelectionRange[];
  scrollTop: VisibleRange;
  isPinned: boolean;
}

export interface EditorLayoutGroup {
  size: number;
  groups?: EditorLayoutGroup[];
}

export interface EditorLayout {
  orientation: number;
  groups: EditorLayoutGroup[];
}

export interface TerminalState {
  name: string;
  cwd?: string;
}

export interface ContextSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workspacePath: string;
  gitBranch?: string;
  editors: EditorState[];
  activeEditorIndex: number;
  editorLayout?: EditorLayout;
  terminals: TerminalState[];
}
