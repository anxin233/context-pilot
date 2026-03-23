import * as vscode from 'vscode';
import { ContextSnapshot, EditorState, TerminalState } from '../types';
import {
  generateId,
  getWorkspaceFolderForPath,
  getWorkspaceIdentity,
  toRelativePath,
} from '../utils/helpers';

export class SnapshotCapture {
  capture(name: string, gitBranch?: string): ContextSnapshot | undefined {
    const workspacePath = getWorkspaceIdentity();
    if (!workspacePath) {
      return undefined;
    }

    const editors = this.captureEditors();
    const activeEditorIndex = this.getActiveEditorIndex(editors);
    const terminals = this.captureTerminals();
    const now = Date.now();

    return {
      id: generateId(),
      name,
      createdAt: now,
      updatedAt: now,
      workspacePath,
      gitBranch,
      editors,
      activeEditorIndex,
      terminals,
    };
  }

  private captureEditors(): EditorState[] {
    const editors: EditorState[] = [];
    const visibleEditors = new Map<string, vscode.TextEditor>();

    for (const editor of vscode.window.visibleTextEditors) {
      visibleEditors.set(editor.document.uri.fsPath, editor);
    }

    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input;
        if (!(input instanceof vscode.TabInputText)) {
          continue;
        }

        const fsPath = input.uri.fsPath;
        const workspaceFolder = getWorkspaceFolderForPath(fsPath);
        if (!workspaceFolder) {
          continue;
        }

        const relativePath = toRelativePath(fsPath, workspaceFolder.uri.fsPath);
        const visibleEditor = visibleEditors.get(fsPath);

        const editorState: EditorState = {
          filePath: relativePath,
          workspaceFolderName: workspaceFolder.name,
          viewColumn: group.viewColumn,
          cursorPosition: visibleEditor
            ? {
                line: visibleEditor.selection.active.line,
                character: visibleEditor.selection.active.character,
              }
            : { line: 0, character: 0 },
          selections: visibleEditor
            ? visibleEditor.selections.map(sel => ({
                start: { line: sel.start.line, character: sel.start.character },
                end: { line: sel.end.line, character: sel.end.character },
              }))
            : [],
          scrollTop: visibleEditor?.visibleRanges[0]
            ? {
                startLine: visibleEditor.visibleRanges[0].start.line,
                endLine: visibleEditor.visibleRanges[0].end.line,
              }
            : { startLine: 0, endLine: 0 },
          isPinned: tab.isPinned,
        };

        editors.push(editorState);
      }
    }

    return editors;
  }

  private getActiveEditorIndex(editors: EditorState[]): number {
    const active = vscode.window.activeTextEditor;
    if (!active) {
      return 0;
    }

    const workspaceFolder = getWorkspaceFolderForPath(active.document.uri.fsPath);
    if (!workspaceFolder) {
      return 0;
    }

    const activePath = toRelativePath(active.document.uri.fsPath, workspaceFolder.uri.fsPath);
    const idx = editors.findIndex(
      e => e.filePath === activePath && e.workspaceFolderName === workspaceFolder.name
    );
    return idx >= 0 ? idx : 0;
  }

  captureTerminals(): TerminalState[] {
    return vscode.window.terminals.map(t => ({
      name: t.name,
      cwd: (t.creationOptions as vscode.TerminalOptions)?.cwd?.toString(),
    }));
  }
}
