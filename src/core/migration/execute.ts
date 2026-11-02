/**
 * Executes a migration plan: pre-flight checks, dry-run diff, physical moves,
 * manifest writes, verification and rollback snapshot management.
 *
 * `planConversion` is pure (no writes); `applyConversion` performs the work.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { createTwoFilesPatch } from 'diff';
import { fileExists, isInside, readTextFile, relativePath, run, writeTextFile } from '../process.js';
import { buildModel, parseManifestFile, type ProjectModel } from '../cargo/project.js';
import { PACKAGE_ENTRIES, ROOT_KEEP, planMigration, type MigrationPlan } from './plan.js';
import type { SnapshotStore } from '../snapshot.js';
import type { CargoService } from '../cargo/cargo.js';
import { verify, type VerificationReport } from '../verify.js';
import { t } from '../i18n.js';

export interface ConversionOptions {
  root: string;
  extractFields?: string[];
  readmeHandling?: 'keep' | 'copy';
  targetDirName?: string;
  /** Only compute the plan; never touch disk. */
  dryRun: boolean;
  gitCheck?: boolean;
  token?: { isCancellationRequested: boolean };
}

export interface PreflightIssue {
  id: string;
  severity: 'blocking' | 'warning' | 'info';
  message: string;
}

export interface FileOperation {
  kind: 'write' | 'move' | 'create-dir' | 'delete';
  path: string;
  to?: string;
  /** Unified diff for write operations. */
  diff?: string;
}

export interface ConversionPlanResult {
  ok: boolean;
  issues: PreflightIssue[];
  plan?: MigrationPlan;
  operations: FileOperation[];
  targetDir?: string;
  model?: ProjectModel;
  /** Files that reference the package path and may need manual updates. */
  hardCodedReferences: string[];
  gitDirty?: string[];
  packageName?: string;
}

/** Check whether the directory is a convertible single package. */
export async function preflight(root: string, options: { targetDirName?: string; gitCheck?: boolean } = {}): Promise<{
  model?: ProjectModel;
  issues: PreflightIssue[];
  packageName?: string;
  targetDir?: string;
}> {
  const issues: PreflightIssue[] = [];
  const built = await buildModel(root);
  if (!built.model) {
    return { issues: [{ id: 'no-manifest', severity: 'blocking', message: t('No Cargo.toml found.') }] };
  }
  const model = built.model;

  if (model.kind === 'workspace') {
    issues.push({
      id: 'already-workspace',
      severity: 'blocking',
      message: t('This directory is already a workspace root; conversion is not available.'),
    });
  }

  const manifest = (await parseManifestFile(model.manifestPath)).data ?? {};
  const pkg = (manifest.package ?? {}) as Record<string, unknown>;
  const packageName = String(pkg.name ?? path.basename(root));
  const targetDirName = options.targetDirName ?? packageName;
  const targetDir = path.join(root, 'crates', targetDirName);

  if (await fileExists(targetDir)) {
    issues.push({
      id: 'target-exists',
      severity: 'blocking',
      message: t('Target directory crates/{0} already exists. Choose another directory name.', targetDirName),
    });
  }

  if (!pkg.name) {
    issues.push({ id: 'no-package-name', severity: 'blocking', message: t('The manifest has no [package] name.') });
  }

  if (model.hasLockfile) {
    issues.push({
      id: 'lockfile',
      severity: 'info',
      message: t('Cargo.lock will be regenerated at the workspace root.'),
    });
  }

  return { model, issues, packageName, targetDir };
}

export async function planConversion(options: ConversionOptions): Promise<ConversionPlanResult> {
  const { model, issues, packageName, targetDir } = await preflight(options.root, {
    targetDirName: options.targetDirName,
    gitCheck: options.gitCheck,
  });
  const blocking = issues.some((i) => i.severity === 'blocking');

  let gitDirty: string[] | undefined;
  if (options.gitCheck !== false) {
    const status = await run('git', ['status', '--porcelain'], { cwd: options.root, timeoutMs: 20_000 });
    if (status.code === 0 && status.stdout.trim()) {
      gitDirty = status.stdout.trim().split('\n').map((l) => l.trim());
      issues.push({
        id: 'git-dirty',
        severity: 'warning',
        message: t('The git working tree has uncommitted changes. Committing first is recommended.'),
      });
    }
  }

  if (!model || blocking || !packageName || !targetDir) {
    return { ok: false, issues, operations: [], gitDirty, hardCodedReferences: [] };
  }

  const original = await readTextFile(model.manifestPath);
  const extractFields = options.extractFields ?? defaultExtractFields(original);
  const plan = planMigration({
    packageName,
    rootManifestText: original,
    readmeHandling: options.readmeHandling ?? 'keep',
    extractFields,
    workspaceRoot: options.root,
    packageDir: options.root,
    targetDir,
  });

  const operations: FileOperation[] = [];
  operations.push({
    kind: 'write',
    path: path.join(options.root, 'Cargo.toml'),
    diff: createTwoFilesPatch('Cargo.toml', 'Cargo.toml', original, plan.workspaceManifest, 'before', 'after'),
  });

  const moves = await planMoves(options.root, targetDir);
  for (const move of moves) {
    operations.push({ kind: 'move', path: move.from, to: move.to, diff: undefined });
    if (move.kind === 'manifest') {
      const memberOriginal = await readTextFile(move.from);
      operations.push({
        kind: 'write',
        path: move.to,
        diff: createTwoFilesPatch(
          relativePath(options.root, move.from),
          relativePath(options.root, move.to),
          memberOriginal,
          plan.memberManifest,
          'before',
          'after',
        ),
      });
    }
  }
  operations.push({ kind: 'create-dir', path: path.join(options.root, 'crates') });
  operations.push({ kind: 'create-dir', path: targetDir });

  const hardCodedReferences = await detectHardCodedReferences(options.root, packageName);

  return {
    ok: true,
    issues,
    plan,
    operations,
    targetDir,
    model,
    hardCodedReferences,
    gitDirty,
    packageName,
  };
}

function defaultExtractFields(manifestText: string): string[] {
  const data = parseToml(manifestText) as Record<string, unknown>;
  const pkg = (data.package ?? {}) as Record<string, unknown>;
  // Only fields present in the manifest can be extracted; version/edition are
  // auto-extracted because they are the common workspace-wide policy.
  const fields: string[] = [];
  for (const field of ['version', 'edition', 'rust-version']) {
    if (field in pkg) fields.push(field);
  }
  return fields;
}

interface MoveEntry {
  from: string;
  to: string;
  kind: 'manifest' | 'other';
}

/** Physical entries that move into the member directory. */
export async function planMoves(root: string, targetDir: string): Promise<MoveEntry[]> {
  const moves: MoveEntry[] = [];
  for (const entry of PACKAGE_ENTRIES) {
    const source = path.join(root, entry);
    if (!(await fileExists(source))) continue;
    moves.push({ from: source, to: path.join(targetDir, entry), kind: entry === 'Cargo.toml' ? 'manifest' : 'other' });
  }
  return moves;
}

/** Files elsewhere in the repo that mention the package name as a path. */
async function detectHardCodedReferences(root: string, packageName: string): Promise<string[]> {
  const hits: string[] = [];
  const skip = new Set(['target', 'node_modules', '.git']);
  const patterns = [new RegExp(`crates/|${escapeRegExp(packageName)}/`, 'i')];

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 3 || hits.length > 20) return;
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }
      if (!/\.(ya?ml|toml|json|sh|ps1|md|txt|Dockerfile)$/i.test(entry.name)) continue;
      if (entry.name === 'Cargo.toml' || entry.name === 'Cargo.lock') continue;
      try {
        const content = await readTextFile(full);
        if (patterns.some((p) => p.test(content))) {
          hits.push(relativePath(root, full));
        }
      } catch {
        // Ignore unreadable files.
      }
    }
  };

  await walk(root, 0);
  return hits;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ApplyResult {
  ok: boolean;
  report?: VerificationReport;
  error?: string;
  warnings: string[];
  targetDir?: string;
  /** Materialized plan, so callers can render a migration report. */
  plan?: MigrationPlan;
  moves?: { from: string; to: string }[];
}

/** Execute the conversion, snapshotting every touched path first. */
export async function applyConversion(
  options: ConversionOptions,
  cargo: CargoService,
  snapshots: SnapshotStore,
): Promise<ApplyResult> {
  const planned = await planConversion(options);
  if (!planned.ok || !planned.plan || !planned.targetDir || !planned.model) {
    return { ok: false, error: planned.issues.filter((i) => i.severity === 'blocking').map((i) => i.message).join('\n'), warnings: [] };
  }

  const snapshot = await snapshots.begin('convert-to-workspace');
  const warnings: string[] = [];
  const root = options.root;
  const targetDir = planned.targetDir;

  try {
    // Record originals before moving anything.
    await snapshots.record(snapshot, path.join(root, 'Cargo.toml'));
    const moves = await planMoves(root, targetDir);
    for (const move of moves) {
      await snapshots.recordMove(snapshot, { from: move.from, to: move.to, kind: 'file' });
    }
    if (await fileExists(path.join(root, 'Cargo.lock'))) {
      await snapshots.recordAbsent(snapshot, path.join(root, 'Cargo.lock'));
    }

    await fs.mkdir(path.join(root, 'crates'), { recursive: true });
    snapshots.recordCreatedDir(snapshot, path.join(root, 'crates'));
    await fs.mkdir(targetDir, { recursive: true });
    snapshots.recordCreatedDir(snapshot, targetDir);

    for (const move of moves) {
      await fs.rename(move.from, move.to);
    }

    await writeTextFile(path.join(targetDir, 'Cargo.toml'), planned.plan.memberManifest);
    await writeTextFile(path.join(root, 'Cargo.toml'), planned.plan.workspaceManifest);

    if (options.readmeHandling === 'copy') {
      for (const file of ['README.md', 'LICENSE', 'LICENSE.md']) {
        const source = path.join(root, file);
        if (await fileExists(source)) {
          const dest = path.join(targetDir, file);
          await snapshots.recordAbsent(snapshot, dest);
          await fs.copyFile(source, dest);
        }
      }
    }

    if (await fileExists(path.join(root, 'Cargo.lock'))) {
      await fs.rm(path.join(root, 'Cargo.lock'), { force: true });
    }

    const report = await verify(cargo, {
      cwd: root,
      metadata: true,
      check: true,
      workspace: true,
      fmtCheck: await fileExists(path.join(root, 'rustfmt.toml')) || await fileExists(path.join(root, '.rustfmt.toml')),
      token: options.token,
    });

    if (!report.ok) {
      warnings.push('Verification failed; the converted layout was kept so you can inspect it.');
    } else {
      await snapshots.commit(snapshot);
    }

    return {
      ok: report.ok,
      report,
      warnings,
      targetDir,
      plan: planned.plan,
      moves: moves.map((move) => ({ from: move.from, to: move.to })),
    };
  } catch (err) {
    const rollback = await snapshots.rollback(snapshot);
    warnings.push(...rollback.warnings);
    return {
      ok: false,
      error: `Conversion failed and was rolled back: ${(err as Error).message}`,
      warnings,
    };
  }
}

/** Undo the most recent snapshot. */
export async function rollbackLatest(store: SnapshotStore): Promise<{ ok: boolean; restored: string[]; warnings: string[]; label?: string }> {
  const snapshot = store.latest();
  if (!snapshot) return { ok: false, restored: [], warnings: ['No snapshot available.'] };
  const result = await store.rollback(snapshot);
  return { ok: result.warnings.length === 0, restored: result.restored, warnings: result.warnings, label: snapshot.label };
}

/** Ensure the target is inside the workspace. */
export function assertInsideWorkspace(root: string, target: string): void {
  if (!isInside(root, target)) {
    throw new Error(`Refusing to operate outside the workspace: ${target}`);
  }
}
