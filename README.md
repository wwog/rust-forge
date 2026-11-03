# Rust Forge

**English** | [简体中文](README.zh.md)

A Cargo **metadata and project-engineering** toolkit for VS Code. Rust Forge deliberately stays out of
language intelligence (hover, completion, refactors) — that belongs to rust-analyzer. Everything here is
about `Cargo.toml`, workspace topology, toolchains, and formatting/lint configuration.

## Highlights

- **Upgrade planner 2.0** — review safe upgrades with requirement before/after, feature deltas,
  target-MSRV checks, and an explicit split between manifest rewrites and lockfile-only refreshes.
- **Workspace topology** — move/rename members, edit `default-members`/`exclude` visually, promote
  declarations into `[workspace.dependencies]`, and converge inheritance gaps from Dependency Health.
- **Cargo mirrors** — switch the registry used by Rust Forge's own cargo commands (official, Tsinghua TUNA,
  Aliyun, USTC, RsProxy, or a custom index) without touching `~/.cargo/config.toml`.
- **Format-preserving writes** — every manifest edit, including dependency moves and promotions, keeps
  comments, key order and line endings, then verifies the result with Cargo.

## Features

| Area | What it does |
|---|---|
| **Project view** | Detects `Cargo.toml`, distinguishes single packages from workspaces, creates bin/lib/workspace projects (`cargo new`, or a generated `[workspace]` skeleton with edition 2024 and resolver 3), opens existing projects (prompting when a folder is a workspace member), and adds/removes members. An empty folder shows an initialization flow (single package or workspace) that initializes the open folder **in place** as the project root; a folder with content but no root `Cargo.toml` is treated as a non-Rust project and shows **Create** / **Open** actions instead of a file list. Once a root manifest exists, the same tree is the project file browser: the root lists workspace members plus root-level files and folders, and each member expands to its own directory contents (the `crates` grouping folder is not shown). Lazy loading, file-icon-theme icons, `files.exclude` filtering, new file/folder, rename, delete to the trash, copy path, reveal in the file manager, open to the side, and automatic refresh. Files and plain folders can be dragged into any folder or crate node (crate roots are drop targets but cannot be dragged; external files are copied in), and rename is bound to **F2** (and **Enter** on macOS) as well as the context menu. Right-click a member or the project root to **Run Tests** (the root runs the whole workspace); **Run** appears only for binary crates, detected from `src/main.rs`, `src/bin/*`, or `[[bin]]` targets while respecting `autobins`. |
| **Dependencies** | Tree of *directly declared* dependencies only. In a workspace, root `[workspace.dependencies]` are pinned above the members and split into **local** and **remote** groups; right-click a root dependency to reference it from one or more members, or right-click any direct declaration to **promote it to `[workspace.dependencies]`** (shared features are merged into the entry, per-member extras and `optional` stay on the member). Workspace members expand to show internal path-dependency topology; transitive crates stay hidden. Each node shows the declared requirement, locked version from `Cargo.lock`, and the latest crates.io release. The book action opens the crate's crates.io page; the red trash action removes the declaration after confirmation and `cargo check` verification. |
| **Dependency health** | The pulse action in the Dependencies view runs a health check. `cargo tree -d` duplicates are grouped by package with every dependent path and the requirements that selected each version, explaining whether requirements conflict or merely overlap. It also flags declarations not referenced by source (heuristic scan), `[workspace.dependencies]` entries that no member inherits or that members bypass with direct declarations, and version disagreements between members. **Converge** rewrites bypassing declarations to `workspace = true` in one step, preserving per-member features, `optional` and `default-features`. |
| **Safe upgrades** | Cargo-compatible updates are classified **safe** and preselected. Each row shows the requirement before → after, crate feature additions/removals (with default-feature changes), and a warning when the target release's `rust-version` is newer than the active toolchain (those rows are never auto-selected). Requirements that already admit the target only refresh `Cargo.lock`; manifest rewrites and lockfile refreshes are distinct steps. Major (and `0.x` minor) bumps require explicit confirmation and link to the crate's documentation. |
| **Workspace topology** | A dedicated panel lists members, `default-members` and `exclude` with Cargo's real semantics (explicit members win over exclude, globs are expanded, invalid default members are rejected). Toggle default members, add/remove excludes, and see which globs lose crates. Members can be **moved or renamed**: relative path dependencies in every member, target-specific tables, `[workspace.dependencies]` and `[patch]` entries are rewritten, then the directory is moved and verified. |
| **Install** | crates.io search → select a crate → a right-hand drawer with version constraint, dependency kind, features and a multi-select list of target members → write. The install action only appears in that detail view. In a workspace opened from the view title, no member is preselected and the dependency is written to `[workspace.dependencies]` only; selected members receive `workspace = true` references. A single package always writes to its root manifest. Lockfile state is checked before writing. |
| **Toolchain** | Reads `rust-toolchain.toml`, falls back to `rustup show active-toolchain`. Shows active channel, installed list, available updates, and whether the compiler satisfies `rust-version`. Also manages the **Cargo registry mirror** used by Rust Forge: official crates.io by default, built-in Tsinghua TUNA / Aliyun / USTC / RsProxy, plus custom sparse or git indexes. Blocking prompt with a command preview when `cargo`/`rustup` is missing. |
| **Properties** | Form-based editing of package identity, publishing metadata and build options: `version`, `edition`, `rust-version`, `authors`, `license`, `license-file`, `repository`, `homepage`, `documentation`, `readme`, `keywords`, `categories`, `publish`, `include`/`exclude`, `build`, `links`, `default-run`, auto-discovery flags, and `[workspace]` policy (resolver, members, default members, excluded paths). Workspace mode also edits `[workspace.package]` defaults that members inherit. |
| **rustfmt** | Generates a conservative commented `rustfmt.toml` and edits a broad catalogue of layout, comment, import, heuristic and style options (including nightly-only ones, clearly flagged), with a filter box and per-scope workspace/member editing. |
| **Standardize** | Finds configuration that belongs in dedicated files (rustfmt/clippy metadata in `Cargo.toml`, inline lint levels) and moves it with a diff preview plus `cargo fmt --check` / `cargo clippy` smoke tests. |
| **Convert to workspace** | Full single-package → workspace migration: physical move into `crates/<name>`, `[workspace.package]` extraction, dependency promotion to `[workspace.dependencies]`, path-dependency rewriting, lint inheritance, and verification. |
| **Security** | RustSec advisories on dependency nodes via `cargo audit --json` when available, otherwise the OSV API (which mirrors RustSec). Cached on disk. |

### Upgrade planner 2.0

Open **Review Safe Upgrades** from the Dependencies view title. Safe rows are preselected, except rows whose
target release needs a newer compiler than the active toolchain. There is deliberately **no one-click batch
apply**: select the rows you reviewed and confirm.

Each row shows:

- the declared requirement → the requirement that would be written;
- crate feature additions/removals between the locked and target release, including default-feature changes;
- the target release's `rust-version`, compared with the active toolchain, with a warning when it is newer;
- whether the change rewrites the manifest or only refreshes `Cargo.lock`.

The two write paths are explicit:

| Situation | Action |
|---|---|
| The declared requirement already admits the target | `cargo update -p <name> --precise <version>` (lockfile only) |
| The requirement itself must change | Format-preserving manifest rewrite, then `cargo update -p <name>` |

Major (and `0.x` minor) upgrades are never preselected and link to the crate's documentation. Manifest changes
are shown as native diffs and require a modal confirmation; a verification pass runs after the lock refresh.

### Workspace topology

The **Workspace Topology** panel (Project view title) is the visual home for the workspace layout:

- members with their covering pattern, root-package/glob status and whether they are default members;
- `default-members` toggles written as Cargo paths (not package names — Cargo rejects those);
- `exclude` editing with warnings when an exclusion drops a glob member or is ignored for an explicit member;
- automatic removal of a default member that `exclude` makes non-member, so the panel never writes an
  invalid manifest.

**Move or rename a member** from its context menu. Rust Forge rewrites `workspace.members`,
`default-members` and `exclude`, every relative path dependency in every member (including
`[target.'cfg(...)'.dependencies]`, dev and build tables), `[workspace.dependencies]` path entries and
`[patch.*]`, plus the moved package's own outbound paths and `readme`/`license-file`/`build` paths that point
outside the member. The directory is then renamed, manifests are written, and `cargo metadata` + `cargo check`
verify the result. A mid-operation failure restores the previous layout automatically; there is no user-facing
rollback command.

**Promote to workspace dependency** on a direct declaration gathers every member declaration of that package,
refuses conflicting keys/sources/versions, moves shared features to `[workspace.dependencies]`, and leaves
per-member extras, `optional` and `default-features` overrides on the member reference. Path dependencies are
recomputed relative to the workspace root.

**Converge** in Dependency Health rewrites members that bypass an existing `[workspace.dependencies]` entry to
`workspace = true`, preserving extras. Incompatible requirements are refused (or offered as a workspace-entry
update when every direct declaration agrees), never silently changed.

### Cargo mirrors

The Toolchain view has a **Cargo mirror** node and a title action for switching the registry used by Rust Forge.
Built-in options (URLs verified against each mirror's documentation):

| Mirror | Index |
|---|---|
| Official crates.io | Cargo default; no replacement is injected |
| Tsinghua TUNA | `sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/` |
| Aliyun | `sparse+https://mirrors.aliyun.com/crates.io-index/` |
| USTC | `sparse+https://mirrors.ustc.edu.cn/crates.io-index/` |
| RsProxy | `sparse+https://rsproxy.cn/index/` |

Custom sparse or git indexes can be added; names must be unique and credentials in URLs are rejected. The
selection is applied **only to cargo processes started by Rust Forge** through global `--config` arguments
(and `--index` for `cargo install`, which does not honor source replacement for the installed crate). It never
writes `~/.cargo/config.toml`, so builds started outside VS Code keep your normal configuration.

`official` means "do not inject a replacement"; if your global Cargo configuration already selects a mirror,
Rust Forge will keep using it. Switching to another mirror may re-download the index/dependencies because Cargo
caches by source identity. Rust Forge's own crates.io metadata and advisory lookups are not affected.

### Safety model

- Every manifest write goes through a **format-preserving TOML editor**: comments, ordering and spacing survive.
- Writes are followed by verification (`cargo metadata --no-deps`, and `cargo check` / `fmt --check` / `clippy` where relevant).
- Destructive operations (upgrades, member moves, promotion/convergence, conversion, standardization) show a
  diff first and verify after writing.
- Member moves snapshot the manifest and directory before touching disk; a failure while applying the move
  restores the previous layout automatically. Like other operations, there is no user-facing rollback command.
- Mirror selection is passed as cargo process arguments only. No Cargo configuration file is created or modified.

## Getting started

1. Open a folder containing `Cargo.toml`, or run **Rust Forge: Create Rust Project**.
2. Open the Rust Forge activity bar icon.
3. Use the Project title actions for workspace topology, properties, rustfmt, standardization, or conversion;
   use the Dependencies title actions for install, **Review Safe Upgrades**, and Dependency Health; use the
   Toolchain title actions for toolchain updates and **Cargo mirror** selection.

## Settings

| Setting | Default | Description |
|---|---|---|
| `rustForge.cargoPath` | `""` | Path to `cargo`; empty resolves from `PATH`. |
| `rustForge.rustupPath` | `""` | Path to `rustup`. |
| `rustForge.offline` | `false` | Never contact crates.io or the advisory database. |
| `rustForge.auditEnabled` | `true` | Show RustSec markers on dependencies. |
| `rustForge.auditCacheHours` | `6` | Advisory cache lifetime. |
| `rustForge.networkTimeoutMs` | `8000` | Registry/advisory request timeout. |
| `rustForge.crateDocsOpenMode` | `browser` | Open crate pages in the default browser, or in VS Code's built-in Simple Browser webview (`webview`). |
| `rustForge.cargoMirror` | `official` | Cargo registry mirror for Rust Forge's cargo commands: `official`, `tuna`, `aliyun`, `ustc`, `rsproxy`, or `custom:<name>`. |
| `rustForge.cargoMirrors` | `[]` | Custom mirrors added from the Toolchain view (`{ "name", "index" }`). |

The mirror is injected as cargo `--config source.crates-io.replace-with=...` arguments only for processes
started by Rust Forge (metadata, check, update, clippy, and Run/Run Tests terminals). Because `cargo install`
does not honor source replacement for the crate being installed, install commands also receive the selected
index via `--index`. The extension never writes `~/.cargo/config.toml`, so builds started outside VS Code keep
using your normal configuration. The mirror affects cargo only; Rust Forge's crates.io metadata and advisory
lookups still use their own HTTPS endpoints.

## Localization

The UI ships in English and Simplified Chinese. Manifest options are described in the VS Code UI
language; error messages come from the extension l10n bundle (`l10n/bundle.l10n.zh-cn.json`).

## Requirements

- VS Code 1.100 or newer.
- A Rust toolchain on `PATH` for project operations (the extension explains how to install rustup when
  it is missing).
- `cargo-audit` is optional; the OSV fallback needs no installation.

## Development

```bash
npm install
npm run build      # bundles extension + webview
npm test           # unit tests (node:test via tsx)
npm run package    # produces a .vsix
```

Press <kbd>F5</kbd> to launch an Extension Development Host.

## Known limitations

- Transitive dependencies are intentionally not listed.
- Unused-dependency detection scans Rust source files; it is a heuristic, and optional or derive-only crates may be skipped.
- Unstable rustfmt options are written only when you opt in; stable rustfmt ignores them with a warning.
- `cargo update --precise` is used only for lockfile-only refreshes; requirement rewrites use `cargo update -p <name>` and let Cargo resolve inside the new requirement.
- Moving a member rewrites Cargo manifests only. References in CI files, scripts, Dockerfiles or documentation are reported as notes but not edited automatically.
- `official` mirror selection does not clear a mirror already configured in global Cargo config; select a specific mirror to override it for Rust Forge.
- Mirror switching can trigger a one-time index/dependency download; Rust Forge's crates.io metadata and advisory lookups are not mirrored, and authenticated/private registries are not supported in the custom-mirror form.

https://marketplace.visualstudio.com/manage/publishers/rust-forge