import * as vscode from 'vscode';
import { SnapshotManager } from '../snapshot/SnapshotManager';

export class StatusBarItem implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly manager: SnapshotManager) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'contextPilot.restore';
    this.item.tooltip = 'Context Pilot — Click to restore a snapshot';

    this.disposables.push(
      manager.onDidChangeActiveSnapshot(() => this.update()),
      manager.onDidChangeSnapshots(() => this.update()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('contextPilot.showStatusBar')) {
          this.updateVisibility();
        }
      })
    );

    this.update();
    this.updateVisibility();
  }

  private update(): void {
    const active = this.manager.getActiveSnapshot();
    const count = this.manager.listSnapshots().length;

    if (active) {
      this.item.text = `$(bookmark) ${active.name}`;
      this.item.tooltip = `Context Pilot: "${active.name}" (${active.editors.length} files)\nClick to switch snapshot`;
    } else {
      this.item.text = `$(bookmark) Context Pilot`;
      this.item.tooltip = `Context Pilot: ${count} snapshot(s)\nClick to restore a snapshot`;
    }
  }

  private updateVisibility(): void {
    const show = vscode.workspace
      .getConfiguration('contextPilot')
      .get<boolean>('showStatusBar', true);
    if (show) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
