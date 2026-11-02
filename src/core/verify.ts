/**
 * Consistency verification after every write.
 *
 * Writes are only "done" once cargo still agrees with the manifest, so the
 * pipeline always ends with `cargo metadata` and, where relevant, a check,
 * fmt check or clippy run.
 */
import type { CargoService } from './cargo/cargo.js';

export interface VerificationStep {
  name: string;
  ok: boolean;
  output: string;
  skipped?: boolean;
  durationMs?: number;
}

export interface VerificationReport {
  ok: boolean;
  steps: VerificationStep[];
  /** True when the caller cancelled verification before it finished. */
  cancelled?: boolean;
}

export interface VerifyOptions {
  cwd: string;
  metadata?: boolean;
  check?: boolean;
  workspace?: boolean;
  fmtCheck?: boolean;
  clippy?: boolean;
  package?: string;
  token?: { isCancellationRequested: boolean };
  onStep?: (step: VerificationStep) => void;
  /** Called just before a step runs, so progress UIs can name the current step. */
  onStepStart?: (name: string) => void;
}

export async function verify(cargo: CargoService, options: VerifyOptions): Promise<VerificationReport> {
  const steps: VerificationStep[] = [];
  const buildReport = (): VerificationReport => {
    const ok = steps.every((step) => step.ok || step.skipped);
    return { ok, steps, cancelled: !ok && !!options.token?.isCancellationRequested };
  };
  const runStep = async (name: string, action: () => Promise<VerificationStep>): Promise<VerificationStep> => {
    options.onStepStart?.(name);
    const step = await action();
    steps.push(step);
    options.onStep?.(step);
    return step;
  };

  if (options.metadata !== false) {
    await runStep('cargo metadata', async () => {
      const started = Date.now();
      // `--no-deps` still validates every workspace manifest but never resolves
      // the registry, so verification stays instant and works offline. Concrete
      // dependency problems are caught by the check/clippy steps below.
      const result = await cargo.metadata(options.cwd, { noDeps: true }, { token: options.token });
      return {
        name: 'cargo metadata',
        ok: result.ok,
        output: result.ok ? 'workspace manifests resolved successfully (--no-deps)' : result.error ?? result.result.stderr,
        durationMs: Date.now() - started,
      };
    });
    if (steps[steps.length - 1] && !steps[steps.length - 1].ok) {
      return buildReport();
    }
  }

  if (options.check) {
    await runStep('cargo check', async () => {
      const result = await cargo.check(
        options.cwd,
        { workspace: options.workspace, package: options.package },
        { token: options.token },
      );
      return {
        name: 'cargo check',
        ok: result.code === 0,
        output: tail(result.stderr || result.stdout, 4000),
        durationMs: result.durationMs,
      };
    });
  }

  if (options.fmtCheck) {
    await runStep('cargo fmt --check', async () => {
      const result = await cargo.fmtCheck(options.cwd, { token: options.token });
      return {
        name: 'cargo fmt --check',
        ok: result.code === 0,
        output: tail(result.stderr || result.stdout, 4000),
        durationMs: result.durationMs,
      };
    });
  }

  if (options.clippy) {
    await runStep('cargo clippy', async () => {
      const result = await cargo.clippy(
        options.cwd,
        { allTargets: true, workspace: options.workspace },
        { token: options.token },
      );
      return {
        name: 'cargo clippy --all-targets',
        ok: result.code === 0,
        output: tail(result.stderr || result.stdout, 4000),
        durationMs: result.durationMs,
      };
    });
  }

  return buildReport();
}

export function tail(text: string, limit: number): string {
  if (text.length <= limit) return text.trim();
  return `…${text.slice(text.length - limit).trim()}`;
}

/** Render a report as plain text for output channels and notifications. */
export function formatReport(report: VerificationReport): string {
  return report.steps
    .map((step) => {
      const status = step.skipped ? 'SKIP' : step.ok ? 'OK  ' : 'FAIL';
      const duration = step.durationMs !== undefined ? ` (${(step.durationMs / 1000).toFixed(1)}s)` : '';
      const output = step.output ? `\n${step.output}` : '';
      return `[${status}] ${step.name}${duration}${output}`;
    })
    .join('\n\n');
}
