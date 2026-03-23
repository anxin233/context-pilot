import * as vscode from 'vscode';
import { StorageService } from './storage/StorageService';
import { SnapshotManager } from './snapshot/SnapshotManager';
import { SnapshotExporter } from './snapshot/SnapshotExporter';
import { GitIntegration } from './git/GitIntegration';
import { StatusBarItem } from './ui/StatusBarItem';
import { registerTreeView } from './ui/SnapshotTreeView';
import { QuickPickMenu } from './ui/QuickPickMenu';

let snapshotManager: SnapshotManager;
let gitIntegration: GitIntegration;
let statusBarItem: StatusBarItem;
let quickPickMenu: QuickPickMenu;
let snapshotExporter: SnapshotExporter;

export async function activate(context: vscode.ExtensionContext) {
  const storage = new StorageService(context.globalState);
  snapshotManager = new SnapshotManager(storage);
  quickPickMenu = new QuickPickMenu(snapshotManager);
  snapshotExporter = new SnapshotExporter(snapshotManager, storage);

  statusBarItem = new StatusBarItem(snapshotManager);
  context.subscriptions.push(statusBarItem);

  registerTreeView(context, snapshotManager, () => gitIntegration?.getCurrentBranch());

  context.subscriptions.push(
    vscode.commands.registerCommand('contextPilot.save', () => cmdSave()),
    vscode.commands.registerCommand('contextPilot.restore', () => quickPickMenu.showRestorePick()),
    vscode.commands.registerCommand('contextPilot.delete', () => quickPickMenu.showDeletePick()),
    vscode.commands.registerCommand('contextPilot.rename', () => quickPickMenu.showRenamePick()),
    vscode.commands.registerCommand('contextPilot.toggleAutoSwitch', () => cmdToggleAutoSwitch()),
    vscode.commands.registerCommand('contextPilot.exportSnapshot', () => snapshotExporter.exportSnapshot()),
    vscode.commands.registerCommand('contextPilot.importSnapshot', () => snapshotExporter.importSnapshot()),
    vscode.commands.registerCommand('contextPilot.compareSnapshots', () => snapshotExporter.compareSnapshots()),
  );

  registerQuickSwitchSlots(context);

  gitIntegration = new GitIntegration();
  context.subscriptions.push(gitIntegration);

  const gitAvailable = await gitIntegration.initialize();
  if (gitAvailable) {
    context.subscriptions.push(
      gitIntegration.onDidChangeBranch(async ({ oldBranch, newBranch }) => {
        const autoSwitch = vscode.workspace
          .getConfiguration('contextPilot')
          .get<boolean>('autoSwitchOnBranch', false);

        if (!autoSwitch) {
          return;
        }

        if (oldBranch) {
          const existing = snapshotManager.getSnapshotForBranch(oldBranch);
          if (existing) {
            await snapshotManager.updateSnapshot(existing.id, oldBranch);
          } else {
            await snapshotManager.saveSnapshot(`branch: ${oldBranch}`, oldBranch);
          }
        } else {
          await snapshotManager.saveSnapshot(`auto: detached before ${newBranch}`);
        }

        const targetSnapshot = snapshotManager.getSnapshotForBranch(newBranch);
        if (targetSnapshot) {
          const restored = await snapshotManager.restoreSnapshot(targetSnapshot.id);
          if (restored) {
            vscode.window.showInformationMessage(
              `Context Pilot: Restored context for branch "${newBranch}".`
            );
          }
        } else {
          vscode.window.showInformationMessage(
            `Context Pilot: Switched to "${newBranch}" — no snapshot found.`
          );
        }
      })
    );
  }
}

async function cmdSave(): Promise<void> {
  const currentBranch = gitIntegration?.getCurrentBranch();
  const name = await vscode.window.showInputBox({
    prompt: 'Enter a name for this snapshot',
    placeHolder: 'e.g. feature-login, bug-fix-342',
    value: currentBranch ?? '',
    validateInput: (v) => (v.trim() ? null : 'Name cannot be empty'),
  });

  if (!name) {
    return;
  }

  const snapshot = await snapshotManager.saveSnapshot(name.trim(), currentBranch);
  if (snapshot) {
    const branchInfo = snapshot.gitBranch ? ` [${snapshot.gitBranch}]` : '';
    vscode.window.showInformationMessage(
      `Context Pilot: Snapshot "${snapshot.name}" saved (${snapshot.editors.length} files)${branchInfo}.`
    );
  }
}

async function cmdToggleAutoSwitch(): Promise<void> {
  const config = vscode.workspace.getConfiguration('contextPilot');
  const current = config.get<boolean>('autoSwitchOnBranch', false);
  await config.update('autoSwitchOnBranch', !current, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    `Context Pilot: Auto branch switch ${!current ? 'enabled' : 'disabled'}.`
  );
}

function registerQuickSwitchSlots(context: vscode.ExtensionContext): void {
  for (let i = 1; i <= 9; i++) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`contextPilot.quickSwitch${i}`, () =>
        quickPickMenu.quickSwitchByIndex(i - 1)
      )
    );
  }
}

export function getSnapshotManager(): SnapshotManager {
  return snapshotManager;
}

export function getGitIntegration(): GitIntegration {
  return gitIntegration;
}

export function deactivate() {
  snapshotManager?.dispose();
  gitIntegration?.dispose();
}
