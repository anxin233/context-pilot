import * as vscode from 'vscode';
import { ContextSnapshot } from '../types';

const STORAGE_KEY = 'contextPilot.snapshots';

export class StorageService {
  constructor(private readonly globalState: vscode.Memento) {}

  getAll(): ContextSnapshot[] {
    return this.globalState.get<ContextSnapshot[]>(STORAGE_KEY, []);
  }

  getById(id: string): ContextSnapshot | undefined {
    return this.getAll().find(s => s.id === id);
  }

  getByWorkspace(workspacePath: string): ContextSnapshot[] {
    return this.getAll().filter(s => s.workspacePath === workspacePath);
  }

  getByBranch(workspacePath: string, branch: string): ContextSnapshot | undefined {
    return this.getAll()
      .filter(s => s.workspacePath === workspacePath && s.gitBranch === branch)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  async save(snapshot: ContextSnapshot): Promise<void> {
    const all = this.getAll();
    const idx = all.findIndex(s => s.id === snapshot.id);
    if (idx >= 0) {
      all[idx] = snapshot;
    } else {
      all.push(snapshot);
    }
    await this.globalState.update(STORAGE_KEY, all);
  }

  async delete(id: string): Promise<boolean> {
    const all = this.getAll();
    const filtered = all.filter(s => s.id !== id);
    if (filtered.length === all.length) {
      return false;
    }
    await this.globalState.update(STORAGE_KEY, filtered);
    return true;
  }

  async rename(id: string, newName: string): Promise<boolean> {
    const all = this.getAll();
    const snapshot = all.find(s => s.id === id);
    if (!snapshot) {
      return false;
    }
    snapshot.name = newName;
    snapshot.updatedAt = Date.now();
    await this.globalState.update(STORAGE_KEY, all);
    return true;
  }

  async clear(): Promise<void> {
    await this.globalState.update(STORAGE_KEY, []);
  }

  count(): number {
    return this.getAll().length;
  }

  async enforceMaxSnapshots(max: number): Promise<ContextSnapshot[]> {
    const all = this.getAll();
    if (all.length <= max) {
      return [];
    }
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    const removed = all.splice(max);
    await this.globalState.update(STORAGE_KEY, all);
    return removed;
  }
}
