# Rust Forge

[English](README.md) | **简体中文**

面向 VS Code 的 Cargo **元数据与工程化配置**工具包。Rust Forge 刻意不涉足语言智能（悬停、补全、重构）——
那属于 rust-analyzer。这里的一切都围绕 `Cargo.toml`、工作区拓扑、工具链以及格式化/lint 配置。

## 功能

| 领域 | 功能说明 |
|---|---|
| **项目视图** | 检测 `Cargo.toml`，区分单包与工作区，创建 bin/lib/工作区项目（`cargo new`，或生成使用 edition 2024、resolver 3 的 `[workspace]` 骨架），打开已有项目（当文件夹是工作区成员时会给出提示），并添加/移除成员。同一棵树同时是项目文件浏览器：根节点下列出工作区成员与根目录文件/文件夹，成员直接展开自身目录（不再显示 `crates` 分组目录）。懒加载、跟随当前文件图标主题、遵循 `files.exclude`，支持新建文件/文件夹、重命名、删除到废纸篓、复制路径、在文件管理器中显示、在侧边打开，并随文件系统变化自动刷新。右键成员或项目根可**运行测试**（根节点运行整个工作区）；**运行**仅对二进制 crate 显示，依据 `src/main.rs`、`src/bin/*` 或 `[[bin]]` 目标检测，并遵循 `autobins`。 |
| **依赖** | 仅展示*直接声明*的依赖树。工作区中，根清单的 `[workspace.dependencies]` 会置顶显示，并分为**本地依赖**与**远端依赖**两组；右键根依赖可快速引入到一个或多个成员。工作区成员可展开以查看内部 path 依赖拓扑；传递依赖保持隐藏。每个节点显示声明的版本要求、`Cargo.lock` 中的锁定版本以及 crates.io 上的最新版本。书本图标操作会打开该 crate 的 crates.io 页面；红色垃圾桶图标会在二次确认并通过 `cargo check` 校验后移除声明。 |
| **依赖体检** | 依赖视图标题栏的脉冲图标会执行体检。基于 `cargo tree -d`，按包聚合重复版本，展示每个版本的依赖来源路径与选择该版本的版本约束，并解释约束是真正冲突还是仅范围重叠。同时标记源码中未引用的声明（启发式扫描）、没有成员继承或被成员直接声明绕过的 `[workspace.dependencies]` 条目，以及成员之间的版本不一致。 |
| **安全升级** | 在声明范围内、符合 SemVer 的更新被归类为**安全**并默认勾选。主版本（以及 `0.x` 次版本）升级需要显式确认，并提供该 crate 的文档链接。feature 集合发生变化时会被保留下来供审阅。 |
| **安装** | crates.io 搜索 → 选择 crate → 右侧抽屉中设置版本约束、依赖类型、features，并多选目标成员 → 写入。安装操作只在详情视图中出现。从视图标题进入工作区时默认不选成员，只写入 `[workspace.dependencies]`；选中的成员会收到 `workspace = true` 引用。单包项目始终写入根清单。写入前会检查锁文件状态。 |
| **工具链** | 读取 `rust-toolchain.toml`，回退到 `rustup show active-toolchain`。显示当前生效的 channel、已安装列表、可用更新，以及编译器是否满足 `rust-version`。缺少 `cargo`/`rustup` 时会弹出带命令预览的阻塞式提示。 |
| **属性** | 以表单方式编辑包标识、发布元数据与构建选项：`version`、`edition`、`rust-version`、`authors`、`license`、`license-file`、`repository`、`homepage`、`documentation`、`readme`、`keywords`、`categories`、`publish`、`include`/`exclude`、`build`、`links`、`default-run`、自动发现开关，以及 `[workspace]` 级策略（resolver、成员列表、默认成员、排除路径）。workspace 模式还可编辑供成员继承的 `[workspace.package]` 默认值。 |
| **rustfmt** | 生成带注释的保守型 `rustfmt.toml`，并覆盖排版、注释、import、换行启发式与风格等大量选项（nightly-only 选项会明确标记），支持筛选以及 workspace/成员两种范围。 |
| **标准化** | 找出应放在专用文件里的配置（`Cargo.toml` 中的 rustfmt/clippy 元数据、内联 lint 级别），在 diff 预览与 `cargo fmt --check` / `cargo clippy` 冒烟测试之后将其迁移出去。 |
| **转换为工作区** | 完整的单包 → 工作区迁移：物理移动到 `crates/<name>`、提取 `[workspace.package]`、把依赖提升到 `[workspace.dependencies]`、重写 path 依赖、lint 继承与校验。 |
| **安全** | 通过 `cargo audit --json`（可用时）为依赖节点提供 RustSec 安全公告，否则使用 OSV API（与 RustSec 同步）。结果缓存在磁盘上。 |

### 安全模型

- 每次清单写入都经过**保留格式的 TOML 编辑器**：注释、顺序和空白都会保留。
- 写入后都会进行校验（`cargo metadata --no-deps`，以及在相关场景下的 `cargo check` / `fmt --check` / `clippy`）。
- 破坏性操作（升级、转换、标准化）先展示 diff，写入后再校验；转换中途失败会自动恢复。

## 快速开始

1. 打开包含 `Cargo.toml` 的文件夹，或运行 **Rust Forge: Create Rust Project**。
2. 打开活动栏中的 Rust Forge 图标。
3. 使用视图标题栏的操作进行安装/升级/属性/rustfmt/标准化/转换。

## 设置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| `rustForge.cargoPath` | `""` | `cargo` 的路径；留空则从 `PATH` 解析。 |
| `rustForge.rustupPath` | `""` | `rustup` 的路径。 |
| `rustForge.offline` | `false` | 不访问 crates.io 或安全公告数据库。 |
| `rustForge.auditEnabled` | `true` | 在依赖上显示 RustSec 标记。 |
| `rustForge.auditCacheHours` | `6` | 安全公告缓存的有效期。 |
| `rustForge.networkTimeoutMs` | `8000` | 注册表/安全公告请求的超时时间。 |
| `rustForge.crateDocsOpenMode` | `browser` | 在默认浏览器中打开 crate 页面，或在 VS Code 内置的 Simple Browser webview 中打开（`webview`）。 |

## 本地化

界面提供英文和简体中文。清单中的选项描述使用 VS Code 的 UI 语言；错误消息来自扩展的 l10n 资源包
（`l10n/bundle.l10n.zh-cn.json`）。

## 环境要求

- VS Code 1.100 或更高版本。
- `PATH` 中需有 Rust 工具链以执行项目操作（缺少 rustup 时扩展会说明如何安装）。
- `cargo-audit` 为可选项；OSV 回退方案无需安装任何东西。

## 开发

```bash
npm install
npm run build      # 打包扩展 + webview
npm test           # 单元测试（node:test via tsx）
npm run package    # 生成 .vsix
```

按 <kbd>F5</kbd> 启动 Extension Development Host。

## 已知限制

- 有意不列出传递依赖。
- 未使用依赖检测基于 Rust 源文件扫描，属于启发式判断；可选依赖或仅通过 derive 使用的 crate 可能被跳过。
- 不稳定的 rustfmt 选项只在你主动选择时才会写入；稳定的 rustfmt 会忽略它们并给出警告。
- 有意不使用 `cargo update --precise`；升级会重写版本要求，由 Cargo 自行解析。
