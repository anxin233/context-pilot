import * as vscode from 'vscode';
import { SnapshotManager } from '../snapshot/SnapshotManager';
import { ContextSnapshot } from '../types';
import { formatRelativeTime } from '../utils/helpers';
import * as path from 'path';

type TreeNode = SnapshotNode | FileNode;

class SnapshotNode extends vscode.TreeItem {
  constructor(public readonly snapshot: ContextSnapshot, isActive: boolean) {
    super(snapshot.name, vscode.TreeItemCollapsibleState.Collapsed);

    const fileCount = snapshot.editors.length;
    const branch = snapshot.gitBranch ? ` $(git-branch) ${snapshot.gitBranch}` : '';
    const time = formatRelativeTime(snapshot.updatedAt);
    const activeMarker = isActive ? ' $(check)' : '';

    this.description = `${fileCount} files · ${time}${branch}${activeMarker}`;
    this.tooltip = [
      `Name: ${snapshot.name}`,
      `Files: ${fileCount}`,
      snapshot.gitBranch ? `Branch: ${snapshot.gitBranch}` : null,
      `Updated: ${new Date(snapshot.updatedAt).toLocaleString()}`,
      `Created: ${new Date(snapshot.createdAt).toLocaleString()}`,
      `Workspace: ${snapshot.workspacePath}`,
    ]
      .filter(Boolean)
      .join('\n');

    this.iconPath = new vscode.ThemeIcon(isActive ? 'bookmark' : 'archive');
    this.contextValue = 'snapshot';
  }
}

class FileNode extends vscode.TreeItem {
  constructor(filePath: string, isPinned: boolean) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.None);
    this.description = path.dirname(filePath) === '.' ? '' : path.dirname(filePath);
    this.tooltip = filePath;
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = 'snapshotFile';

    if (isPinned) {
      this.description = (this.description ? this.description + ' ' : '') + '$(pinned)';
    }
  }
}

export class SnapshotTreeDataProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    TreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];

  constructor(private readonly manager: SnapshotManager) {
    this.disposables.push(
      manager.onDidChangeSnapshots(() => this.refresh()),
      manager.onDidChangeActiveSnapshot(() => this.refresh())
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      const snapshots = this.manager.listSnapshots();
      return snapshots
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(
          (s) => new SnapshotNode(s, s.id === this.manager.activeId)
        );
    }

    if (element instanceof SnapshotNode) {
      return element.snapshot.editors.map(
        (e) => new FileNode(e.filePath, e.isPinned)
      );
    }

    return [];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

export function registerTreeView(
  context: vscode.ExtensionContext,
  manager: SnapshotManager,
  getCurrentBranch?: () => string | undefined
): SnapshotTreeDataProvider {
  const provider = new SnapshotTreeDataProvider(manager);

  const treeView = vscode.window.createTreeView('contextPilotExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView, provider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'contextPilot.treeRestore',
      async (node: SnapshotNode) => {
        await manager.restoreSnapshot(node.snapshot.id);
      }
    ),
    vscode.commands.registerCommand(
      'contextPilot.treeDelete',
      async (node: SnapshotNode) => {
        const answer = await vscode.window.showWarningMessage(
          `Delete snapshot "${node.snapshot.name}"?`,
          { modal: true },
          'Delete'
        );
        if (answer === 'Delete') {
          await manager.deleteSnapshot(node.snapshot.id);
        }
      }
    ),
    vscode.commands.registerCommand(
      'contextPilot.treeRename',
      async (node: SnapshotNode) => {
        const newName = await vscode.window.showInputBox({
          prompt: 'Enter new name',
          value: node.snapshot.name,
          validateInput: (v) => (v.trim() ? null : 'Name cannot be empty'),
        });
        if (newName) {
          await manager.renameSnapshot(node.snapshot.id, newName.trim());
        }
      }
    ),
    vscode.commands.registerCommand(
      'contextPilot.treeUpdate',
      async (node: SnapshotNode) => {
        await manager.updateSnapshot(node.snapshot.id, getCurrentBranch?.());
        vscode.window.showInformationMessage(
          `Context Pilot: Snapshot "${node.snapshot.name}" updated.`
        );
      }
    ),
    vscode.commands.registerCommand('contextPilot.refreshTree', () => {
      provider.refresh();
    })
  );

  return provider;
}
