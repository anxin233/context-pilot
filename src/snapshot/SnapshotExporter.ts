import * as vscode from 'vscode';
import { ContextSnapshot } from '../types';
import { SnapshotManager } from './SnapshotManager';
import { formatRelativeTime, getWorkspaceIdentity } from '../utils/helpers';
import { StorageService } from '../storage/StorageService';
import { generateId } from '../utils/helpers';

export class SnapshotExporter {
  constructor(
    private readonly manager: SnapshotManager,
    private readonly storage: StorageService
  ) {}

  async exportSnapshot(): Promise<void> {
    const snapshots = this.manager.listSnapshots();
    if (snapshots.length === 0) {
      vscode.window.showInformationMessage('Context Pilot: No snapshots to export.');
      return;
    }

    const items = snapshots
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => ({
        label: `$(bookmark) ${s.name}`,
        description: `${s.editors.length} files · ${formatRelativeTime(s.updatedAt)}`,
        snapshotId: s.id,
      }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a snapshot to export',
    });

    if (!picked) {
      return;
    }

    const snapshot = this.storage.getById(picked.snapshotId);
    if (!snapshot) {
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${snapshot.name}.context-pilot.json`),
      filters: {
        'Context Pilot Snapshot': ['context-pilot.json', 'json'],
      },
    });

    if (!uri) {
      return;
    }

    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      snapshot: this.sanitizeForExport(snapshot),
    };

    const content = Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(uri, content);

    vscode.window.showInformationMessage(
      `Context Pilot: Snapshot "${snapshot.name}" exported successfully.`
    );
  }

  async importSnapshot(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'Context Pilot Snapshot': ['context-pilot.json', 'json'],
      },
      openLabel: 'Import Snapshot',
    });

    if (!uris || uris.length === 0) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(uris[0]);
      const text = Buffer.from(content).toString('utf-8');
      const data = JSON.parse(text);

      if (!data.version || !data.snapshot) {
        vscode.window.showErrorMessage(
          'Context Pilot: Invalid snapshot file format.'
        );
        return;
      }

      const snapshot: ContextSnapshot = data.snapshot;
      snapshot.id = generateId();
      snapshot.createdAt = snapshot.createdAt || Date.now();
      snapshot.updatedAt = Date.now();

      const workspacePath = getWorkspaceIdentity();
      if (workspacePath) {
        snapshot.workspacePath = workspacePath;
      }

      await this.manager.importSnapshot(snapshot);

      vscode.window.showInformationMessage(
        `Context Pilot: Snapshot "${snapshot.name}" imported successfully.`
      );
    } catch {
      vscode.window.showErrorMessage(
        'Context Pilot: Failed to parse snapshot file.'
      );
    }
  }

  async compareSnapshots(): Promise<void> {
    const snapshots = this.manager.listSnapshots();
    if (snapshots.length < 2) {
      vscode.window.showInformationMessage(
        'Context Pilot: Need at least 2 snapshots to compare.'
      );
      return;
    }

    const items = snapshots
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => ({
        label: `$(bookmark) ${s.name}`,
        description: `${s.editors.length} files · ${formatRelativeTime(s.updatedAt)}`,
        snapshotId: s.id,
      }));

    const first = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select FIRST snapshot to compare',
    });
    if (!first) {
      return;
    }

    const remainingItems = items.filter((i) => i.snapshotId !== first.snapshotId);
    const second = await vscode.window.showQuickPick(remainingItems, {
      placeHolder: 'Select SECOND snapshot to compare',
    });
    if (!second) {
      return;
    }

    const snap1 = this.storage.getById(first.snapshotId);
    const snap2 = this.storage.getById(second.snapshotId);
    if (!snap1 || !snap2) {
      return;
    }

    const files1 = new Set(snap1.editors.map((e) => e.filePath));
    const files2 = new Set(snap2.editors.map((e) => e.filePath));

    const onlyIn1 = [...files1].filter((f) => !files2.has(f));
    const onlyIn2 = [...files2].filter((f) => !files1.has(f));
    const shared = [...files1].filter((f) => files2.has(f));

    const lines: string[] = [
      `Comparing: "${snap1.name}" vs "${snap2.name}"`,
      '',
      `Shared files (${shared.length}):`,
      ...shared.map((f) => `  ${f}`),
      '',
      `Only in "${snap1.name}" (${onlyIn1.length}):`,
      ...onlyIn1.map((f) => `  + ${f}`),
      '',
      `Only in "${snap2.name}" (${onlyIn2.length}):`,
      ...onlyIn2.map((f) => `  + ${f}`),
    ];

    const doc = await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'plaintext',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  private sanitizeForExport(snapshot: ContextSnapshot): ContextSnapshot {
    return {
      ...snapshot,
      id: '',
      workspacePath: '',
    };
  }
}
