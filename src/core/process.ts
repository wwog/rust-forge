/**
 * Process execution helpers. All cargo/rustup/git calls funnel through here so
 * that logging, cancellation and error shaping stay consistent.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface RunOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  token?: { isCancellationRequested: boolean };
  stdin?: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  command: string;
  durationMs: number;
  /** True when the binary could not be spawned at all. */
  missingBinary?: boolean;
  timedOut?: boolean;
  /** True when the caller's cancellation token stopped the process. */
  cancelled?: boolean;
}

export class CommandError extends Error {
  constructor(message: string, readonly result: RunResult) {
    super(message);
    this.name = 'CommandError';
  }
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args.map(quoteArg)].join(' ');
}

function quoteArg(arg: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Time a cancelled process gets before it is killed outright. */
const CANCEL_GRACE_MS = 2_000;
/** Time a killed process gets before the promise settles without `close`. */
const SETTLE_GRACE_MS = 250;

export async function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  const started = Date.now();
  return new Promise<RunResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let timers: NodeJS.Timeout[] = [];
    let cancelCheck: NodeJS.Timeout | undefined;

    // cargo is usually a rustup proxy that starts the real toolchain binary as
    // a child. Killing only the proxy leaves the toolchain process (and rustc)
    // holding our pipes open, so `close` never fires and callers wait forever.
    // A dedicated process group lets us signal the whole tree.
    const useGroup = process.platform !== 'win32';
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env, CARGO_TERM_COLOR: 'never', NO_COLOR: '1' },
      shell: false,
      detached: useGroup,
    });

    const killTree = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (useGroup) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        // The process already exited.
      }
    };

    const after = (ms: number, action: () => void) => {
      timers.push(setTimeout(action, ms));
    };

    const stopTimers = () => {
      for (const timer of timers) clearTimeout(timer);
      timers = [];
      if (cancelCheck) {
        clearInterval(cancelCheck);
        cancelCheck = undefined;
      }
    };

    const finish = (code: number, missingBinary = false) => {
      if (settled) return;
      settled = true;
      stopTimers();
      resolve({
        code,
        stdout,
        stderr,
        command: formatCommand(command, args),
        durationMs: Date.now() - started,
        missingBinary,
        timedOut,
        cancelled,
      });
    };

    if (options.timeoutMs) {
      after(options.timeoutMs, () => {
        if (settled) return;
        timedOut = true;
        killTree('SIGKILL');
        // Do not depend on `close`: a surviving grandchild can keep the pipes
        // open indefinitely and leave progress notifications spinning.
        after(SETTLE_GRACE_MS, () => finish(124));
      });
    }

    if (options.token) {
      cancelCheck = setInterval(() => {
        if (settled || cancelled || !options.token!.isCancellationRequested) return;
        cancelled = true;
        killTree('SIGTERM');
        after(CANCEL_GRACE_MS, () => {
          if (settled) return;
          killTree('SIGKILL');
          after(SETTLE_GRACE_MS, () => finish(130));
        });
      }, 100);
    }

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < 8_000_000) stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < 8_000_000) stderr += chunk;
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        finish(127, true);
      } else {
        stderr += `\n${err.message}`;
        finish(1);
      }
    });

    // `exit` fires even when descendants still hold stdout; settle shortly
    // after it so a stuck pipe cannot strand the caller.
    child.on('exit', (code) => {
      if (settled) return;
      after(100, () => finish(timedOut ? 124 : cancelled ? 130 : (code ?? 1)));
    });

    child.on('close', (code) => {
      finish(timedOut ? 124 : cancelled ? 130 : (code ?? 1));
    });

    if (options.stdin !== undefined) {
      child.stdin?.end(options.stdin);
    } else {
      child.stdin?.end();
    }
  });
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(file: string): Promise<string> {
  return fs.readFile(file, 'utf8');
}

export async function writeTextFile(file: string, content: string): Promise<void> {
  await fs.writeFile(file, content, 'utf8');
}

export async function findUp(startDir: string, fileName: string, stopAt?: string): Promise<string | undefined> {
  let dir = path.resolve(startDir);
  const stop = stopAt ? path.resolve(stopAt) : undefined;
  for (;;) {
    const candidate = path.join(dir, fileName);
    if (await fileExists(candidate)) return candidate;
    if (stop && dir === stop) return undefined;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Convert an absolute path to a workspace-relative, slash-separated path. */
export function relativePath(root: string, target: string): string {
  const rel = path.relative(root, target);
  return rel.split(path.sep).join('/');
}

export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Find a binary on PATH without invoking a shell. */
export async function which(binary: string, extraPath?: string): Promise<string | undefined> {
  if (path.isAbsolute(binary)) {
    return (await fileExists(binary)) ? binary : undefined;
  }
  const dirs = (extraPath ?? process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext);
      if (await fileExists(candidate)) return candidate;
    }
  }
  return undefined;
}

/** PATH supplemented with the usual cargo/rustup install locations. */
export function augmentedPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const extra = [
    path.join(home, '.cargo', 'bin'),
    process.platform === 'win32' ? path.join(home, '.cargo', 'bin') : '/usr/local/bin',
    '/opt/homebrew/bin',
  ];
  return [...(process.env.PATH ?? '').split(path.delimiter), ...extra].filter(Boolean).join(path.delimiter);
}
