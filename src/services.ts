/** Extension-wide services, created once and shared by views and commands. */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AuditService } from './core/audit.js';
import { CargoService } from './core/cargo/cargo.js';
import { RegistryClient } from './core/deps/registry.js';
import { SnapshotStore } from './core/snapshot.js';
import { ToolchainService } from './core/toolchain.js';
import { readSettings, type Settings } from './settings.js';

export class Services implements vscode.Disposable {
  private cargoService: CargoService;
  private registryClient: RegistryClient;
  private toolchainService: ToolchainService;
  private auditService: AuditService;
  private snapshotStores = new Map<string, SnapshotStore>();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    const settings = readSettings();
    this.cargoService = new CargoService({
      cargoPath: settings.cargoPath,
      offline: settings.offline,
      timeoutMs: 120_000,
    });
    this.registryClient = new RegistryClient({
      offline: settings.offline,
      timeoutMs: settings.networkTimeoutMs,
    });
    this.toolchainService = new ToolchainService({
      cargoPath: settings.cargoPath,
      rustupPath: settings.rustupPath,
    });
    this.auditService = new AuditService({
      offline: settings.offline,
      cacheHours: settings.auditCacheHours,
      cacheDir: path.join(context.globalStorageUri.fsPath, 'audit'),
    });

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('rustForge')) this.reconfigure();
      }),
    );
  }

  get settings(): Settings {
    return readSettings();
  }

  get cargo(): CargoService {
    return this.cargoService;
  }

  get registry(): RegistryClient {
    return this.registryClient;
  }

  get toolchain(): ToolchainService {
    return this.toolchainService;
  }

  get audit(): AuditService {
    return this.auditService;
  }

  snapshotStore(workspaceRoot: string): SnapshotStore {
    const existing = this.snapshotStores.get(workspaceRoot);
    if (existing) return existing;
    const store = new SnapshotStore(workspaceRoot, path.join(this.context.globalStorageUri.fsPath, 'snapshots', encodeKey(workspaceRoot)));
    this.snapshotStores.set(workspaceRoot, store);
    return store;
  }

  private reconfigure(): void {
    const settings = readSettings();
    this.cargoService = new CargoService({
      cargoPath: settings.cargoPath,
      offline: settings.offline,
      timeoutMs: 120_000,
    });
    this.registryClient = new RegistryClient({
      offline: settings.offline,
      timeoutMs: settings.networkTimeoutMs,
    });
    this.toolchainService = new ToolchainService({
      cargoPath: settings.cargoPath,
      rustupPath: settings.rustupPath,
    });
    this.auditService = new AuditService({
      offline: settings.offline,
      cacheHours: settings.auditCacheHours,
      cacheDir: path.join(this.context.globalStorageUri.fsPath, 'audit'),
    });
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
  }
}

function encodeKey(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 32);
}
