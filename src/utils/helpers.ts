import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';

export function generateId(): string {
  return crypto.randomUUID();
}

export function toRelativePath(absolutePath: string, workspacePath: string): string {
  return path.relative(workspacePath, absolutePath);
}

export function toAbsolutePath(relativePath: string, workspacePath: string): string {
  return path.resolve(workspacePath, relativePath);
}

export function getWorkspaceIdentity(): string | undefined {
  if (vscode.workspace.workspaceFile) {
    return vscode.workspace.workspaceFile.fsPath;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  return folders
    .map((folder) => folder.uri.fsPath)
    .sort()
    .join('::');
}

export function getWorkspaceFolderForPath(absolutePath: string): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absolutePath));
}

export function resolveSnapshotFilePath(
  relativePath: string,
  workspaceIdentity: string,
  workspaceFolderName?: string
): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    if (workspaceFolderName) {
      const matchingFolder = folders.find((folder) => folder.name === workspaceFolderName);
      if (matchingFolder) {
        return path.resolve(matchingFolder.uri.fsPath, relativePath);
      }
    }

    if (folders.length === 1) {
      return path.resolve(folders[0].uri.fsPath, relativePath);
    }
  }

  if (!workspaceIdentity.includes('::')) {
    return path.resolve(workspaceIdentity, relativePath);
  }

  return undefined;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) { return '刚刚'; }
  if (diffMin < 60) { return `${diffMin} 分钟前`; }
  if (diffHour < 24) { return `${diffHour} 小时前`; }
  if (diffDay < 30) { return `${diffDay} 天前`; }
  return new Date(timestamp).toLocaleDateString();
}

export function truncateList(items: string[], max: number): string {
  if (items.length <= max) {
    return items.join(', ');
  }
  return items.slice(0, max).join(', ') + ` +${items.length - max} more`;
}
