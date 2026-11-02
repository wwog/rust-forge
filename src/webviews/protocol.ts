/** Message protocol between the extension host and webview panels. */
import type { StandardizeChangePreview, StandardizeFinding } from '../core/standardize.js';
import type { InstallRequest } from '../core/deps/write.js';
import type { DependencyTable } from '../core/cargo/types.js';

export type PanelKind = 'install' | 'upgrade' | 'properties' | 'rustfmt' | 'standardize' | 'convert' | 'wizard' | 'audit';

export interface DependencyRow {
  id: string;
  label: string;
  /** Crate name, which differs from `label` for renamed dependencies. */
  packageName: string;
  member: string;
  requirement?: string;
  locked?: string;
  latest?: string;
  classification: 'safe' | 'major' | 'not-applicable' | 'unknown';
  reason?: string;
  features: string[];
  optional: boolean;
  advisories: { id: string; title: string; severity: string; url?: string; fixed?: string }[];
  registryUnavailable: boolean;
  isWorkspaceDependency: boolean;
  table: DependencyTable;
}

export interface UpgradePanelData {
  kind: 'upgrade-panel';
  rows: DependencyRow[];
  registryDegraded: boolean;
  workspace: boolean;
}

export interface InstallPanelData {
  kind: 'install-panel';
  workspace: boolean;
  members: { name: string; manifestPath: string }[];
  /** Prefills when invoked from a specific member node. Empty means workspace-only. */
  defaultMembers: string[];
  defaultTable: DependencyTable;
  /** Search results are requested on demand. */
  initialQuery?: string;
}

export interface CrateSearchResult {
  name: string;
  version: string;
  description?: string;
  downloads?: number;
  updatedAt?: string;
}

export interface CrateVersionChoice {
  version: string;
  rustVersion?: string;
  yanked: boolean;
  features: string[];
  defaultFeatures: string[];
}

export interface CrateDetailData {
  name: string;
  description?: string;
  repository?: string;
  documentation?: string;
  latest: string;
  versions: CrateVersionChoice[];
  /** Lockfile state for this dependency in the selected member. */
  lockState: 'up-to-date' | 'resolved-not-cached' | 'constraint-unsatisfied' | 'no-lockfile' | 'unknown';
  lockMessage?: string;
}

export interface PropertiesPanelData {
  kind: 'properties-panel';
  workspace: boolean;
  /** True when the root manifest has its own [package] table. */
  hasRootPackage: boolean;
  packageProperties: PropertyPanelField[];
  workspaceProperties: PropertyPanelField[];
  /** [workspace.package] defaults that members can inherit. */
  workspacePackageProperties: PropertyPanelField[];
  members: { name: string; manifestPath: string }[];
}

export interface PropertyPanelField {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'enum' | 'version' | 'boolean' | 'array';
  value?: string;
  inherited?: boolean;
  workspaceValue?: string;
  location: string;
  values?: string[];
  placeholder?: string;
  risky?: boolean;
  /** Effective value when the key is absent (booleans). */
  defaultValue?: string;
  /** True when Cargo allows `key.workspace = true` for this field. */
  inheritable?: boolean;
  /** UI grouping. */
  group?: string;
  memberValues?: { member: string; value?: string; inherited: boolean }[];
}

export interface RustfmtPanelData {
  kind: 'rustfmt-panel';
  workspace: boolean;
  scope: 'workspace' | 'member';
  filePath?: string;
  fileExists: boolean;
  values: Record<string, string | number | boolean | string[]>;
  options: RustfmtOptionData[];
  memberScopeAvailable: boolean;
  activeMember?: string;
  warning?: string;
}

export interface RustfmtOptionData {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'array';
  value?: string | number | boolean | string[];
  default?: string | number | boolean | string[];
  values?: string[];
  stable: boolean;
  min?: number;
  max?: number;
  category: string;
}

export interface StandardizePanelData {
  kind: 'standardize-panel';
  findings: {
    id: string;
    title: string;
    description: string;
    fixable: boolean;
    diffs: StandardizeChangePreview[];
  }[];
  workspace: boolean;
}

export interface ConvertPanelData {
  kind: 'convert-panel';
  packageName: string;
  targetDir: string;
  issues: { id: string; severity: 'blocking' | 'warning' | 'info'; message: string }[];
  extractableFields: { key: string; value: string; defaultExtract: boolean; present: boolean }[];
  operations: { kind: string; path: string; to?: string; diff?: string }[];
  promoted: { name: string; workspaceValue: string; memberValue: string; features: string[] }[];
  kept: { name: string; table: string; reason: string }[];
  hardCodedReferences: string[];
  gitDirty?: string[];
  readmeHandling: string;
  canApply: boolean;
}

export interface WizardPanelData {
  kind: 'wizard-panel';
  mode: 'create' | 'open';
  steps: { id: string; title: string }[];
}

export type PanelData =
  | UpgradePanelData
  | InstallPanelData
  | PropertiesPanelData
  | RustfmtPanelData
  | StandardizePanelData
  | ConvertPanelData
  | WizardPanelData;

export interface Toast {
  type: 'toast';
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface ProgressMessage {
  type: 'progress';
  active: boolean;
  message?: string;
}

export interface DiffMessage {
  type: 'diff';
  title: string;
  body: string;
}

export interface BusyMessage {
  type: 'busy';
  active: boolean;
  label?: string;
}

export interface SetDataMessage {
  type: 'setData';
  data: PanelData;
}

export interface SearchResultsMessage {
  type: 'searchResults';
  results: CrateSearchResult[];
}

export interface CrateDetailMessage {
  type: 'crateDetail';
  detail: CrateDetailData;
}

export interface CrateDetailFailedMessage {
  type: 'crateDetailFailed';
  name: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type HostMessage =
  | SetDataMessage
  | SearchResultsMessage
  | CrateDetailMessage
  | CrateDetailFailedMessage
  | Toast
  | ProgressMessage
  | DiffMessage
  | BusyMessage
  | ErrorMessage;

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'webviewError'; message: string }
  | { type: 'searchCrates'; query: string }
  | { type: 'selectCrate'; name: string; member?: string }
  | { type: 'install'; request: InstallRequestPayload }
  | { type: 'upgradeSelected'; ids: string[] }
  | { type: 'upgradeAllSafe' }
  | { type: 'saveProperties'; edits: PropertyEditPayload[] }
  | { type: 'saveRustfmt'; edits: { key: string; value: string | number | boolean | string[] | undefined }[]; scope: 'workspace' | 'member' }
  | { type: 'generateRustfmt'; scope: 'workspace' | 'member' }
  | { type: 'applyStandardization'; ids: string[] }
  | { type: 'previewStandardization'; ids: string[] }
  | { type: 'convert'; options: { extractFields: string[]; readmeHandling: 'keep' | 'copy'; targetDirName?: string } }
  | { type: 'cancel' }
  | { type: 'openFile'; path: string }
  | { type: 'openUrl'; url: string }
  | { type: 'refresh' }
  | { type: 'runCommand'; command: string; args?: unknown[] }
  | { type: 'close' };

export interface InstallRequestPayload {
  packageName: string;
  versionReq?: string;
  table: DependencyTable;
  features?: string[];
  optional?: boolean;
  noDefaultFeatures?: boolean;
  workspaceMode: boolean;
  /** Selected members; empty means workspace-only in workspace mode. */
  memberNames?: string[];
}

export interface PropertyEditPayload {
  key: string;
  value?: string;
  inherit?: boolean;
  target: 'package' | 'workspace' | 'workspace.package';
}

export { StandardizeFinding, InstallRequest };
