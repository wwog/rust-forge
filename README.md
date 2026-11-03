# Rust Forge

**English** | [简体中文](README.zh.md)

A Cargo **metadata and project-engineering** toolkit for VS Code. Rust Forge deliberately stays out of
language intelligence (hover, completion, refactors) — that belongs to rust-analyzer. Everything here is
about `Cargo.toml`, workspace topology, toolchains, and formatting/lint configuration.

## Features

| Area | What it does |
|---|---|
| **Project view** | Detects `Cargo.toml`, distinguishes single packages from workspaces, creates bin/lib/workspace projects (`cargo new`, or a generated `[workspace]` skeleton with edition 2024 and resolver 3), opens existing projects (prompting when a folder is a workspace member), and adds/removes members. The same tree is the project file browser: the root lists workspace members plus root-level files and folders, and each member expands to its own directory contents (the `crates` grouping folder is not shown). Lazy loading, file-icon-theme icons, `files.exclude` filtering, new file/folder, rename, delete to the trash, copy path, reveal in the file manager, open to the side, and automatic refresh. Right-click a member or the project root to **Run Tests** (the root runs the whole workspace); **Run** appears only for binary crates, detected from `src/main.rs`, `src/bin/*`, or `[[bin]]` targets while respecting `autobins`. |
| **Dependencies** | Tree of *directly declared* dependencies only. In a workspace, root `[workspace.dependencies]` are pinned above the members and split into **local** and **remote** groups; right-click a root dependency to reference it from one or more members. Workspace members expand to show internal path-dependency topology; transitive crates stay hidden. Each node shows the declared requirement, locked version from `Cargo.lock`, and the latest crates.io release. The book action opens the crate's crates.io page; the red trash action removes the declaration after confirmation and `cargo check` verification. |
| **Dependency health** | The pulse action in the Dependencies view runs a health check. `cargo tree -d` duplicates are grouped by package with every dependent path and the requirements that selected each version, explaining whether requirements conflict or merely overlap. It also flags declarations not referenced by source (heuristic scan), `[workspace.dependencies]` entries that no member inherits or that members bypass with direct declarations, and version disagreements between members. |
| **Safe upgrades** | SemVer-compatible updates inside the declared range are classified **safe** and preselected. Major (and `0.x` minor) bumps require explicit confirmation and link to the crate's documentation. Feature-set changes are held back for review. |
| **Install** | crates.io search → select a crate → a right-hand drawer with version constraint, dependency kind, features and a multi-select list of target members → write. The install action only appears in that detail view. In a workspace opened from the view title, no member is preselected and the dependency is written to `[workspace.dependencies]` only; selected members receive `workspace = true` references. A single package always writes to its root manifest. Lockfile state is checked before writing. |
| **Toolchain** | Reads `rust-toolchain.toml`, falls back to `rustup show active-toolchain`. Shows active channel, installed list, available updates, and whether the compiler satisfies `rust-version`. Blocking prompt with a command preview when `cargo`/`rustup` is missing. |
| **Properties** | Form-based editing of package identity, publishing metadata and build options: `version`, `edition`, `rust-version`, `authors`, `license`, `license-file`, `repository`, `homepage`, `documentation`, `readme`, `keywords`, `categories`, `publish`, `include`/`exclude`, `build`, `links`, `default-run`, auto-discovery flags, and `[workspace]` policy (resolver, members, default members, excluded paths). Workspace mode also edits `[workspace.package]` defaults that members inherit. |
| **rustfmt** | Generates a conservative commented `rustfmt.toml` and edits a broad catalogue of layout, comment, import, heuristic and style options (including nightly-only ones, clearly flagged), with a filter box and per-scope workspace/member editing. |
| **Standardize** | Finds configuration that belongs in dedicated files (rustfmt/clippy metadata in `Cargo.toml`, inline lint levels) and moves it with a diff preview plus `cargo fmt --check` / `cargo clippy` smoke tests. |
| **Convert to workspace** | Full single-package → workspace migration: physical move into `crates/<name>`, `[workspace.package]` extraction, dependency promotion to `[workspace.dependencies]`, path-dependency rewriting, lint inheritance, and verification. |
| **Security** | RustSec advisories on dependency nodes via `cargo audit --json` when available, otherwise the OSV API (which mirrors RustSec). Cached on disk. |

### Safety model

- Every manifest write goes through a **format-preserving TOML editor**: comments, ordering and spacing survive.
- Writes are followed by verification (`cargo metadata --no-deps`, and `cargo check` / `fmt --check` / `clippy` where relevant).
- Destructive operations (upgrades, conversion, standardization) show a diff first and verify after writing; a conversion that fails partway is restored automatically.

## Getting started

1. Open a folder containing `Cargo.toml`, or run **Rust Forge: Create Rust Project**.
2. Open the Rust Forge activity bar icon.
3. Use the view title actions for install/upgrade/properties/rustfmt/standardize/convert.

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
- `cargo update --precise` is intentionally not used; upgrades rewrite requirements and let Cargo resolve.

https://marketplace.visualstudio.com/manage/publishers/rust-forge