import * as vscode from 'vscode';
import { ContextSnapshot, EditorState } from '../types';
import { resolveSnapshotFilePath } from '../utils/helpers';
import * as fs from 'fs';

export interface RestoreResult {
  cancelled: boolean;
  failedFiles: string[];
}

export class SnapshotRestore {
  async restore(snapshot: ContextSnapshot): Promise<RestoreResult> {
    const failedFiles: string[] = [];

    const confirmRestore = vscode.workspace
      .getConfiguration('contextPilot')
      .get<boolean>('confirmBeforeRestore', true);

    if (confirmRestore) {
      const answer = await vscode.window.showWarningMessage(
        `Restoring "${snapshot.name}" will close all current editors. Continue?`,
        { modal: true },
        'Yes'
      );
      if (answer !== 'Yes') {
        return { cancelled: true, failedFiles: [] };
      }
    }

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    if (snapshot.editorLayout) {
      try {
        await vscode.commands.executeCommand(
          'vscode.setEditorLayout',
          snapshot.editorLayout
        );
      } catch {
        vscode.window.showWarningMessage(
          'Context Pilot: Failed to restore the saved editor layout.'
        );
      }
    }

    const groupedEditors = this.groupByViewColumn(snapshot.editors);
    const totalFiles = snapshot.editors.length;
    let processed = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Context Pilot: Restoring snapshot...',
        cancellable: false,
      },
      async (progress) => {
        for (const [viewColumn, editors] of groupedEditors) {
          for (const editorState of editors) {
            const success = await this.restoreEditor(
              editorState,
              snapshot.workspacePath,
              viewColumn
            );
            if (!success) {
              failedFiles.push(editorState.filePath);
            }
            processed++;
            progress.report({
              increment: (1 / totalFiles) * 100,
              message: `${processed}/${totalFiles} files`,
            });
          }
        }
      }
    );

    if (snapshot.activeEditorIndex >= 0 && snapshot.activeEditorIndex < snapshot.editors.length) {
      const activeEditor = snapshot.editors[snapshot.activeEditorIndex];
      const absPath = resolveSnapshotFilePath(
        activeEditor.filePath,
        snapshot.workspacePath,
        activeEditor.workspaceFolderName
      );
      if (!absPath) {
        failedFiles.push(activeEditor.filePath);
      } else {
        try {
          const doc = await vscode.workspace.openTextDocument(absPath);
          await vscode.window.showTextDocument(doc, {
            viewColumn: activeEditor.viewColumn,
            preview: false,
          });
        } catch {
          // active editor already in failed list if it failed earlier
        }
      }
    }

    await this.restoreTerminals(snapshot);

    return { cancelled: false, failedFiles };
  }

  private groupByViewColumn(editors: EditorState[]): Map<number, EditorState[]> {
    const groups = new Map<number, EditorState[]>();
    for (const editor of editors) {
      const col = editor.viewColumn;
      if (!groups.has(col)) {
        groups.set(col, []);
      }
      groups.get(col)!.push(editor);
    }
    return groups;
  }

  private async restoreEditor(
    state: EditorState,
    workspacePath: string,
    viewColumn: number
  ): Promise<boolean> {
    const absPath = resolveSnapshotFilePath(
      state.filePath,
      workspacePath,
      state.workspaceFolderName
    );
    if (!absPath) {
      return false;
    }

    if (!fs.existsSync(absPath)) {
      return false;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(absPath);
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn,
        preview: false,
        preserveFocus: true,
      });

      if (state.selections.length > 0) {
        editor.selections = state.selections.map(
          sel =>
            new vscode.Selection(
              new vscode.Position(sel.start.line, sel.start.character),
              new vscode.Position(sel.end.line, sel.end.character)
            )
        );
      } else {
        const pos = new vscode.Position(
          state.cursorPosition.line,
          state.cursorPosition.character
        );
        editor.selection = new vscode.Selection(pos, pos);
      }

      if (state.scrollTop.startLine > 0) {
        const range = new vscode.Range(
          new vscode.Position(state.scrollTop.startLine, 0),
          new vscode.Position(state.scrollTop.endLine, 0)
        );
        editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
      }

      if (state.isPinned) {
        // pinEditor acts on the active editor, so we must focus it first
        await vscode.window.showTextDocument(doc, {
          viewColumn,
          preview: false,
          preserveFocus: false,
        });
        await vscode.commands.executeCommand('workbench.action.pinEditor');
      }

      return true;
    } catch {
      return false;
    }
  }

  private async restoreTerminals(snapshot: ContextSnapshot): Promise<void> {
    if (!snapshot.terminals.length) {
      return;
    }

    const existingTerminalKeys = new Set(
      vscode.window.terminals.map((terminal) =>
        this.getTerminalKey(
          terminal.name,
          this.getTerminalCwd(
            terminal.creationOptions as vscode.TerminalOptions | vscode.ExtensionTerminalOptions
          )
        )
      )
    );

    for (const term of snapshot.terminals) {
      const key = this.getTerminalKey(term.name, term.cwd);
      if (existingTerminalKeys.has(key)) {
        continue;
      }

      vscode.window.createTerminal({
        name: term.name,
        cwd: term.cwd,
      });
      existingTerminalKeys.add(key);
    }
  }

  private getTerminalKey(name: string, cwd?: string): string {
    return `${name}::${cwd ?? ''}`;
  }

  private getTerminalCwd(
    options: vscode.TerminalOptions | vscode.ExtensionTerminalOptions
  ): string | undefined {
    if ('cwd' in options) {
      return options.cwd?.toString();
    }

    return undefined;
  }
}
