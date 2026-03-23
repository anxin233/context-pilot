import * as vscode from 'vscode';
import { ContextSnapshot, EditorLayout } from '../types';
import { StorageService } from '../storage/StorageService';
import { SnapshotCapture } from './SnapshotCapture';
import { SnapshotRestore } from './SnapshotRestore';
import { getWorkspaceIdentity } from '../utils/helpers';

export class SnapshotManager {
  private readonly capture: SnapshotCapture;
  private readonly restorer: SnapshotRestore;
  private activeSnapshotId: string | undefined;

  private readonly _onDidChangeSnapshots = new vscode.EventEmitter<void>();
  readonly onDidChangeSnapshots = this._onDidChangeSnapshots.event;

  private readonly _onDidChangeActiveSnapshot = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeActiveSnapshot = this._onDidChangeActiveSnapshot.event;

  constructor(private readonly storage: StorageService) {
    this.capture = new SnapshotCapture();
    this.restorer = new SnapshotRestore();
  }

  get activeId(): string | undefined {
    return this.activeSnapshotId;
  }

  getActiveSnapshot(): ContextSnapshot | undefined {
    return this.activeSnapshotId
      ? this.storage.getById(this.activeSnapshotId)
      : undefined;
  }

  async saveSnapshot(name: string, gitBranch?: string): Promise<ContextSnapshot | undefined> {
    const snapshot = this.capture.capture(name, gitBranch);
    if (!snapshot) {
      vscode.window.showErrorMessage('Context Pilot: No workspace folder open.');
      return undefined;
    }

    const layout = await this.captureEditorLayout();
    if (layout) {
      snapshot.editorLayout = layout;
    }

    await this.storage.save(snapshot);
    this.setActive(snapshot.id);
    this._onDidChangeSnapshots.fire();

    const maxSnapshots = vscode.workspace
      .getConfiguration('contextPilot')
      .get<number>('maxSnapshots', 50);
    await this.storage.enforceMaxSnapshots(maxSnapshots);

    return snapshot;
  }

  async updateSnapshot(id: string, gitBranch?: string): Promise<ContextSnapshot | undefined> {
    const existing = this.storage.getById(id);
    if (!existing) {
      return undefined;
    }

    const snapshot = this.capture.capture(existing.name, gitBranch ?? existing.gitBranch);
    if (!snapshot) {
      return undefined;
    }

    snapshot.id = existing.id;
    snapshot.createdAt = existing.createdAt;

    const layout = await this.captureEditorLayout();
    if (layout) {
      snapshot.editorLayout = layout;
    }

    await this.storage.save(snapshot);
    this._onDidChangeSnapshots.fire();
    return snapshot;
  }

  async importSnapshot(snapshot: ContextSnapshot): Promise<ContextSnapshot> {
    await this.storage.save(snapshot);
    this._onDidChangeSnapshots.fire();

    const maxSnapshots = vscode.workspace
      .getConfiguration('contextPilot')
      .get<number>('maxSnapshots', 50);
    await this.storage.enforceMaxSnapshots(maxSnapshots);

    return snapshot;
  }

  async restoreSnapshot(id: string): Promise<boolean> {
    const snapshot = this.storage.getById(id);
    if (!snapshot) {
      vscode.window.showErrorMessage('Context Pilot: Snapshot not found.');
      return false;
    }

    const result = await this.restorer.restore(snapshot);
    if (result.cancelled) {
      return false;
    }

    this.setActive(id);
    this._onDidChangeSnapshots.fire();

    if (result.failedFiles.length > 0) {
      vscode.window.showWarningMessage(
        `Context Pilot: ${result.failedFiles.length} file(s) could not be restored: ${result.failedFiles.join(', ')}`
      );
    }

    return true;
  }

  async deleteSnapshot(id: string): Promise<boolean> {
    const success = await this.storage.delete(id);
    if (success) {
      if (this.activeSnapshotId === id) {
        this.setActive(undefined);
      }
      this._onDidChangeSnapshots.fire();
    }
    return success;
  }

  async renameSnapshot(id: string, newName: string): Promise<boolean> {
    const success = await this.storage.rename(id, newName);
    if (success) {
      this._onDidChangeSnapshots.fire();
    }
    return success;
  }

  listSnapshots(): ContextSnapshot[] {
    const workspacePath = getWorkspaceIdentity();
    if (!workspacePath) {
      return this.storage.getAll();
    }
    return this.storage.getByWorkspace(workspacePath);
  }

  listAllSnapshots(): ContextSnapshot[] {
    return this.storage.getAll();
  }

  getSnapshotForBranch(branch: string): ContextSnapshot | undefined {
    const workspacePath = getWorkspaceIdentity();
    if (!workspacePath) {
      return undefined;
    }
    return this.storage.getByBranch(workspacePath, branch);
  }

  private setActive(id: string | undefined): void {
    this.activeSnapshotId = id;
    this._onDidChangeActiveSnapshot.fire(id);
  }

  private async captureEditorLayout(): Promise<EditorLayout | undefined> {
    try {
      const layout = await vscode.commands.executeCommand<EditorLayout>(
        'vscode.getEditorLayout'
      );
      return layout;
    } catch {
      return undefined;
    }
  }

  dispose(): void {
    this._onDidChangeSnapshots.dispose();
    this._onDidChangeActiveSnapshot.dispose();
  }
}
