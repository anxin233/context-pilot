import * as vscode from 'vscode';
import * as path from 'path';

interface GitExtensionAPI {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
}

interface GitRepository {
  state: {
    HEAD: { name?: string } | undefined;
    onDidChange: vscode.Event<void>;
  };
  rootUri: vscode.Uri;
}

export class GitIntegration implements vscode.Disposable {
  private gitApi: GitAPI | undefined;
  private disposables: vscode.Disposable[] = [];
  private readonly lastBranchByRepo = new Map<string, string | undefined>();
  private readonly watchedRepositories = new Set<string>();

  private readonly _onDidChangeBranch = new vscode.EventEmitter<{
    oldBranch: string | undefined;
    newBranch: string;
  }>();
  readonly onDidChangeBranch = this._onDidChangeBranch.event;

  async initialize(): Promise<boolean> {
    const gitExtension = vscode.extensions.getExtension<GitExtensionAPI>(
      'vscode.git'
    );
    if (!gitExtension) {
      return false;
    }

    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }

    try {
      this.gitApi = gitExtension.exports.getAPI(1);
    } catch {
      return false;
    }

    this.gitApi.repositories.forEach((repo) => this.watchRepository(repo));

    this.disposables.push(
      this.gitApi.onDidOpenRepository((repo) => {
        this.watchRepository(repo);
      })
    );

    return true;
  }

  getCurrentBranch(): string | undefined {
    return this.getPrimaryRepository()?.state.HEAD?.name;
  }

  private watchRepository(repo: GitRepository): void {
    const repoKey = repo.rootUri.toString();
    if (this.watchedRepositories.has(repoKey)) {
      return;
    }

    this.watchedRepositories.add(repoKey);
    this.lastBranchByRepo.set(repoKey, repo.state.HEAD?.name);

    this.disposables.push(
      repo.state.onDidChange(() => {
        const lastBranch = this.lastBranchByRepo.get(repoKey);
        const currentBranch = repo.state.HEAD?.name;
        if (currentBranch !== lastBranch) {
          this.lastBranchByRepo.set(repoKey, currentBranch);
        }

        if (currentBranch && currentBranch !== lastBranch) {
          this._onDidChangeBranch.fire({
            oldBranch: lastBranch,
            newBranch: currentBranch,
          });
        }
      })
    );
  }

  private getPrimaryRepository(): GitRepository | undefined {
    if (!this.gitApi || this.gitApi.repositories.length === 0) {
      return undefined;
    }

    const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeFilePath) {
      const activeRepo = this.gitApi.repositories.find((repo) =>
        activeFilePath.startsWith(repo.rootUri.fsPath)
      );
      if (activeRepo) {
        return activeRepo;
      }
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
      const workspaceRepo = this.gitApi.repositories.find(
        (repo) =>
          workspacePath === repo.rootUri.fsPath ||
          workspacePath.startsWith(repo.rootUri.fsPath + path.sep)
      );
      if (workspaceRepo) {
        return workspaceRepo;
      }
    }

    return this.gitApi.repositories[0];
  }

  dispose(): void {
    this._onDidChangeBranch.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.lastBranchByRepo.clear();
    this.watchedRepositories.clear();
  }
}
