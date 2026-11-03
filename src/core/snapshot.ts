/**
 * Snapshot + rollback for destructive operations.
 *
 * Every write batch first records the pre-edit contents of the files it will
 * touch (and any files it will move) in a per-workspace journal. Rollback
 * restores exactly those bytes, so backout works even outside git.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isInside } from './process.js';

export interface SnapshotFile {
  /** Absolute path before the operation. */
  path: string;
  content: string;
}

export interface SnapshotMove {
  from: string;
  to: string;
  /** 'file' copies bytes; 'dir' removes the destination tree on rollback. */
  kind: 'file' | 'dir';
}

export interface Snapshot {
  id: string;
  label: string;
  createdAt: number;
  root: string;
  files: SnapshotFile[];
  /** Files that did not exist before and should be deleted on rollback. */
  createdFiles: string[];
  createdDirs: string[];
  moves: SnapshotMove[];
  /** Directories removed by the operation, restored from backupPath. */
  backupPath?: string;
}

const MAX_SNAPSHOTS = 10;

export class SnapshotStore {
  private snapshots: Snapshot[] = [];
  private backupRoot: string;

  constructor(private readonly workspaceRoot: string, private readonly storageDir: string) {
    this.backupRoot = path.join(storageDir, 'snapshots');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.storageDir, 'snapshots.json'), 'utf8');
      const parsed = JSON.parse(raw) as { snapshots?: Snapshot[] };
      this.snapshots = parsed.snapshots ?? [];
    } catch {
      this.snapshots = [];
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    await fs.writeFile(
      path.join(this.storageDir, 'snapshots.json'),
      JSON.stringify({ snapshots: this.snapshots.slice(-MAX_SNAPSHOTS) }, null, 2),
      'utf8',
    );
  }

  list(): Snapshot[] {
    return [...this.snapshots];
  }

  latest(): Snapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  async begin(label: string): Promise<Snapshot> {
    const snapshot: Snapshot = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      createdAt: Date.now(),
      root: this.workspaceRoot,
      files: [],
      createdFiles: [],
      createdDirs: [],
      moves: [],
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  /** Record a file's current content (once per snapshot). */
  async record(snapshot: Snapshot, file: string): Promise<void> {
    if (snapshot.files.some((f) => f.path === file)) return;
    try {
      const content = await fs.readFile(file, 'utf8');
      // Recording the real content supersedes an earlier "created" marker.
      snapshot.createdFiles = snapshot.createdFiles.filter((path) => path !== file);
      snapshot.files.push({ path: file, content });
    } catch (err) {
      // Only a genuinely missing file should be deleted on rollback. Treating
      // EACCES/EBUSY as "new" would delete the user's manifest.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      if (!snapshot.createdFiles.includes(file)) snapshot.createdFiles.push(file);
    }
  }

  /** Record a file that will be written but may not exist yet. */
  async recordAbsent(snapshot: Snapshot, file: string): Promise<void> {
    if (snapshot.createdFiles.includes(file)) return;
    if (snapshot.files.some((f) => f.path === file)) return;
    snapshot.createdFiles.push(file);
  }

  recordCreatedDir(snapshot: Snapshot, dir: string): void {
    if (!snapshot.createdDirs.includes(dir)) snapshot.createdDirs.push(dir);
  }

  recordMove(snapshot: Snapshot, move: SnapshotMove): void {
    snapshot.moves.push(move);
  }

  /** Back up a directory tree that an operation will delete. */
  async backupDirectory(snapshot: Snapshot, dir: string): Promise<string> {
    const dest = path.join(this.backupRoot, snapshot.id, path.relative(this.workspaceRoot, dir));
    await fs.cp(dir, dest, { recursive: true, force: true });
    snapshot.backupPath = path.join(this.backupRoot, snapshot.id);
    return dest;
  }

  /** Persist the snapshot so it stays available for a later rollback. */
  async commit(snapshot: Snapshot): Promise<void> {
    // The backup tree is only needed while a rollback is still possible.
    await this.discardBackup(snapshot);
    await this.persist();
  }

  async discard(snapshot: Snapshot): Promise<void> {
    this.snapshots = this.snapshots.filter((s) => s.id !== snapshot.id);
    await this.persist();
    await this.discardBackup(snapshot);
  }

  /** Remove the directory backup once the operation can no longer roll back. */
  private async discardBackup(snapshot: Snapshot): Promise<void> {
    if (!snapshot.backupPath) return;
    const backupPath = snapshot.backupPath;
    snapshot.backupPath = undefined;
    try {
      await fs.rm(backupPath, { recursive: true, force: true });
    } catch {
      // A leftover backup is harmless; never fail the operation over cleanup.
    }
  }

  /**
   * Restore a snapshot. Moves are undone first (deepest path first), then file
   * contents, then created artefacts are deleted.
   */
  async rollback(snapshot: Snapshot): Promise<{ restored: string[]; deleted: string[]; warnings: string[] }> {
    const warnings: string[] = [];
    const restored: string[] = [];
    const deleted: string[] = [];

    for (const move of [...snapshot.moves].reverse()) {
      try {
        await fs.mkdir(path.dirname(move.from), { recursive: true });
        await fs.rename(move.to, move.from);
        restored.push(move.from);
      } catch (err) {
        warnings.push(`${move.to} -> ${move.from}: ${(err as Error).message}`);
      }
    }

    for (const file of snapshot.files) {
      try {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content, 'utf8');
        restored.push(file.path);
      } catch (err) {
        warnings.push(`${file.path}: ${(err as Error).message}`);
      }
    }

    for (const file of snapshot.createdFiles) {
      if (isInside(this.workspaceRoot, file) === false) continue;
      try {
        await fs.rm(file, { recursive: true, force: true });
        deleted.push(file);
      } catch (err) {
        warnings.push(`${file}: ${(err as Error).message}`);
      }
    }

    if (snapshot.backupPath) {
      try {
        const entries = await fs.readdir(snapshot.backupPath);
        for (const entry of entries) {
          const source = path.join(snapshot.backupPath, entry);
          const target = path.join(this.workspaceRoot, entry);
          await fs.cp(source, target, { recursive: true, force: true });
        }
        await fs.rm(snapshot.backupPath, { recursive: true, force: true });
      } catch (err) {
        warnings.push(`backup restore: ${(err as Error).message}`);
      }
    }

    for (const dir of [...snapshot.createdDirs].sort((a, b) => b.length - a.length)) {
      try {
        await fs.rmdir(dir);
        deleted.push(dir);
      } catch {
        // Non-empty directories are expected to remain.
      }
    }

    this.snapshots = this.snapshots.filter((s) => s.id !== snapshot.id);
    await this.persist();
    return { restored, deleted, warnings };
  }
}
