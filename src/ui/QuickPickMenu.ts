import * as vscode from 'vscode';
import { SnapshotManager } from '../snapshot/SnapshotManager';
import { ContextSnapshot } from '../types';
import { formatRelativeTime, truncateList } from '../utils/helpers';

interface SnapshotQuickPickItem extends vscode.QuickPickItem {
  snapshotId: string;
  action?: 'restore' | 'delete' | 'rename';
}

export class QuickPickMenu {
  constructor(private readonly manager: SnapshotManager) {}

  async showRestorePick(): Promise<void> {
    const snapshots = this.manager.listSnapshots();
    if (snapshots.length === 0) {
      vscode.window.showInformationMessage(
        'Context Pilot: No snapshots found for this workspace.'
      );
      return;
    }

    const items = this.buildItems(snapshots);

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a snapshot to restore',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (picked) {
      await this.manager.restoreSnapshot(picked.snapshotId);
    }
  }

  async showDeletePick(): Promise<void> {
    const snapshots = this.manager.listSnapshots();
    if (snapshots.length === 0) {
      vscode.window.showInformationMessage('Context Pilot: No snapshots to delete.');
      return;
    }

    const items = this.buildItems(snapshots);

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a snapshot to delete',
    });

    if (picked) {
      const ok = await this.manager.deleteSnapshot(picked.snapshotId);
      if (ok) {
        vscode.window.showInformationMessage('Context Pilot: Snapshot deleted.');
      }
    }
  }

  async showRenamePick(): Promise<void> {
    const snapshots = this.manager.listSnapshots();
    if (snapshots.length === 0) {
      vscode.window.showInformationMessage('Context Pilot: No snapshots to rename.');
      return;
    }

    const items = this.buildItems(snapshots);

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a snapshot to rename',
    });

    if (!picked) {
      return;
    }

    const snapshot = this.manager.listSnapshots().find(s => s.id === picked.snapshotId);
    const newName = await vscode.window.showInputBox({
      prompt: 'Enter new name',
      value: snapshot?.name ?? '',
      validateInput: (v) => (v.trim() ? null : 'Name cannot be empty'),
    });

    if (newName) {
      await this.manager.renameSnapshot(picked.snapshotId, newName.trim());
      vscode.window.showInformationMessage(
        `Context Pilot: Snapshot renamed to "${newName.trim()}".`
      );
    }
  }

  async quickSwitchByIndex(index: number): Promise<void> {
    const maxSlots = vscode.workspace
      .getConfiguration('contextPilot')
      .get<number>('quickSwitchSlots', 9);

    if (index >= maxSlots) {
      vscode.window.showInformationMessage(
        `Context Pilot: Quick switch slot ${index + 1} is disabled by settings.`
      );
      return;
    }

    const snapshots = this.manager
      .listSnapshots()
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (index < 0 || index >= snapshots.length) {
      vscode.window.showInformationMessage(
        `Context Pilot: No snapshot in slot ${index + 1}.`
      );
      return;
    }

    const snapshot = snapshots[index];
    await this.manager.restoreSnapshot(snapshot.id);
  }

  private buildItems(snapshots: ContextSnapshot[]): SnapshotQuickPickItem[] {
    const maxSlots = vscode.workspace
      .getConfiguration('contextPilot')
      .get<number>('quickSwitchSlots', 9);

    return snapshots
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s, idx) => {
        const branch = s.gitBranch ? ` $(git-branch) ${s.gitBranch}` : '';
        const active = s.id === this.manager.activeId ? ' $(check)' : '';
        const slotLabel = idx < maxSlots ? `[${idx + 1}] ` : '';

        return {
          label: `${slotLabel}$(bookmark) ${s.name}${active}`,
          description: `${s.editors.length} files · ${formatRelativeTime(s.updatedAt)}${branch}`,
          detail: truncateList(
            s.editors.map((e) => e.filePath),
            4
          ),
          snapshotId: s.id,
        };
      });
  }
}
