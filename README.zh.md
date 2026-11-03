# Rust Forge

[English](README.md) | **简体中文**

面向 VS Code 的 Cargo **元数据与工程化配置**工具包。Rust Forge 刻意不涉足语言智能（悬停、补全、重构）——
那属于 rust-analyzer。这里的一切都围绕 `Cargo.toml`、工作区拓扑、工具链以及格式化/lint 配置。

## 亮点

- **升级计划器 2.0** —— 审查安全升级：版本约束前后变化、feature 增删、目标版本 MSRV 校验，并明确区分
  “重写清单”与“仅刷新锁文件”。
- **工作区拓扑** —— 移动/重命名成员、可视化编辑 `default-members`/`exclude`、把依赖提升为
  `[workspace.dependencies]`，并从依赖体检一键收敛继承缺口。
- **Cargo 镜像** —— 切换 Rust Forge 自身 cargo 命令使用的镜像源（官方、清华 TUNA、阿里云、中科大、
  RsProxy 或自定义索引），不修改 `~/.cargo/config.toml`。
- **保留格式写入** —— 包括成员移动与依赖提升在内，所有清单修改都保留注释、键顺序与换行，随后用 Cargo 校验。

## 功能

| 领域 | 功能说明 |
|---|---|
| **项目视图** | 检测 `Cargo.toml`，区分单包与工作区，创建 bin/lib/工作区项目（`cargo new`，或生成使用 edition 2024、resolver 3 的 `[workspace]` 骨架），打开已有项目（当文件夹是工作区成员时会给出提示），并添加/移除成员。空文件夹显示初始化入口（单项目或 workspace），会**原地**把当前文件夹初始化为项目根；有内容但根目录没有 `Cargo.toml` 时视为非 Rust 项目，只显示**创建**/**打开**操作，不列出文件。根清单存在后，同一棵树同时是项目文件浏览器：根节点下列出工作区成员与根目录文件/文件夹，成员直接展开自身目录（不再显示 `crates` 分组目录）。懒加载、跟随当前文件图标主题、遵循 `files.exclude`，支持新建文件/文件夹、重命名、删除到废纸篓、复制路径、在文件管理器中显示、在侧边打开，并随文件系统变化自动刷新。文件和普通文件夹可拖入任意目录或 crate 节点（crate 根是放置目标但自身不可拖动；从系统文件管理器拖入会复制），重命名同时绑定 **F2**（macOS 还支持 **回车**）与右键菜单。右键成员或项目根可**运行测试**（根节点运行整个工作区）；**运行**仅对二进制 crate 显示，依据 `src/main.rs`、`src/bin/*` 或 `[[bin]]` 目标检测，并遵循 `autobins`。 |
| **依赖** | 仅展示*直接声明*的依赖树。工作区中，根清单的 `[workspace.dependencies]` 会置顶显示，并分为**本地依赖**与**远端依赖**两组；右键根依赖可快速引入到一个或多个成员，右键任意直接声明可**提升为 `[workspace.dependencies]`**（公共 feature 合并到条目，成员保留额外 feature 与 `optional`）。工作区成员可展开以查看内部 path 依赖拓扑；传递依赖保持隐藏。每个节点显示声明的版本要求、`Cargo.lock` 中的锁定版本以及 crates.io 上的最新版本。书本图标操作会打开该 crate 的 crates.io 页面；红色垃圾桶图标会在二次确认并通过 `cargo check` 校验后移除声明。 |
| **依赖体检** | 依赖视图标题栏的脉冲图标会执行体检。基于 `cargo tree -d`，按包聚合重复版本，展示每个版本的依赖来源路径与选择该版本的版本约束，并解释约束是真正冲突还是仅范围重叠。同时标记源码中未引用的声明（启发式扫描）、没有成员继承或被成员直接声明绕过的 `[workspace.dependencies]` 条目，以及成员之间的版本不一致。**统一为继承**可一步把绕过 workspace 表的声明改写为 `workspace = true`，并保留成员各自的 feature、`optional` 与 `default-features`。 |
| **安全升级** | 在 Cargo 兼容范围内的更新被归类为**安全**并默认勾选。每个条目展示版本约束的前后变化、crate feature 的增删（含默认 feature 变化），以及目标版本的 `rust-version` 高于当前工具链时的警告（此类条目不会被自动勾选）。已满足目标版本的约束只刷新 `Cargo.lock`；清单重写与锁文件刷新是分开的步骤。主版本（以及 `0.x` 次版本）升级需要显式确认，并提供该 crate 的文档链接。 |
| **工作区拓扑** | 专用面板按 Cargo 的真实语义展示成员、`default-members` 与 `exclude`（显式成员优先于 exclude、展开 glob、拒绝无效的默认成员）。可切换默认成员、增删排除目录，并查看哪些 glob 因此少解析了 crate。成员支持**移动/重命名**：所有成员中的相对 path 依赖、target 表、`[workspace.dependencies]` 与 `[patch]` 条目都会重写，随后移动目录并校验。 |
| **安装** | crates.io 搜索 → 选择 crate → 右侧抽屉中设置版本约束、依赖类型、features，并多选目标成员 → 写入。安装操作只在详情视图中出现。从视图标题进入工作区时默认不选成员，只写入 `[workspace.dependencies]`；选中的成员会收到 `workspace = true` 引用。单包项目始终写入根清单。写入前会检查锁文件状态。 |
| **工具链** | 读取 `rust-toolchain.toml`，回退到 `rustup show active-toolchain`。显示当前生效的 channel、已安装列表、可用更新，以及编译器是否满足 `rust-version`。同时管理 Rust Forge 使用的 **Cargo 镜像源**：默认官方 crates.io，内置清华 TUNA / 阿里云 / 中科大 / RsProxy，并支持添加自定义 sparse 或 git 索引。缺少 `cargo`/`rustup` 时会弹出带命令预览的阻塞式提示。 |
| **属性** | 以表单方式编辑包标识、发布元数据与构建选项：`version`、`edition`、`rust-version`、`authors`、`license`、`license-file`、`repository`、`homepage`、`documentation`、`readme`、`keywords`、`categories`、`publish`、`include`/`exclude`、`build`、`links`、`default-run`、自动发现开关，以及 `[workspace]` 级策略（resolver、成员列表、默认成员、排除路径）。workspace 模式还可编辑供成员继承的 `[workspace.package]` 默认值。 |
| **rustfmt** | 生成带注释的保守型 `rustfmt.toml`，并覆盖排版、注释、import、换行启发式与风格等大量选项（nightly-only 选项会明确标记），支持筛选以及 workspace/成员两种范围。 |
| **标准化** | 找出应放在专用文件里的配置（`Cargo.toml` 中的 rustfmt/clippy 元数据、内联 lint 级别），在 diff 预览与 `cargo fmt --check` / `cargo clippy` 冒烟测试之后将其迁移出去。 |
| **转换为工作区** | 完整的单包 → 工作区迁移：物理移动到 `crates/<name>`、提取 `[workspace.package]`、把依赖提升到 `[workspace.dependencies]`、重写 path 依赖、lint 继承与校验。 |
| **安全** | 通过 `cargo audit --json`（可用时）为依赖节点提供 RustSec 安全公告，否则使用 OSV API（与 RustSec 同步）。结果缓存在磁盘上。 |

### 升级计划器 2.0

从依赖视图标题打开 **审查安全升级**。安全行默认勾选，但目标版本需要比当前工具链更新的 Rust 时不会勾选。
这里刻意**没有一键批量应用**：勾选你审查过的条目后确认即可。

每个条目展示：

- 当前声明的版本约束 → 将要写入的约束；
- 锁定版本与目标版本之间的 crate feature 增删，包括默认 feature 变化；
- 目标版本的 `rust-version` 与当前工具链的对比，超出时给出警告；
- 这次变更会重写清单，还是只刷新 `Cargo.lock`。

两条写入路径是明确的：

| 场景 | 动作 |
|---|---|
| 当前约束已经允许目标版本 | `cargo update -p <name> --precise <version>`（只刷新锁文件） |
| 版本约束本身需要修改 | 保留格式地重写清单，然后执行 `cargo update -p <name>` |

主版本（以及 `0.x` 次版本）升级永远不会默认勾选，并提供 crate 文档链接。清单变更以原生 diff 展示，需要
模态确认；锁文件刷新后会再执行一次 Cargo 校验。

### 工作区拓扑

**工作区拓扑** 面板（项目视图标题栏）是 workspace 布局的可视化入口：

- 展示成员、覆盖它的成员模式、根包/glob 状态，以及是否为默认成员；
- `default-members` 以 Cargo 路径写入（不是包名——Cargo 会拒绝包名）；
- 编辑 `exclude`，并在排除项会移除 glob 成员、或对显式成员无效时给出警告；
- 如果 `exclude` 让某个默认成员不再是成员，会自动从 `default-members` 中移除并提示，避免写出非法清单。

**移动/重命名成员**：在成员右键菜单中操作。Rust Forge 会重写 `workspace.members`、
`default-members`、`exclude`，所有成员中的相对 path 依赖（含
`[target.'cfg(...)'.dependencies]`、dev/build 表）、`[workspace.dependencies]` 的 path 条目与
`[patch.*]`，以及被移动包自身的出站路径和指向成员外部的 `readme`/`license-file`/`build`。随后移动目录、
写入清单，并用 `cargo metadata` + `cargo check` 校验。中途失败会自动恢复原布局；没有面向用户的回滚命令。

**提升为 workspace 依赖**：在直接声明上右键。会收集该包在所有成员中的声明，遇到键名/来源/版本冲突时拒绝；
公共 feature 合并到 `[workspace.dependencies]`，成员保留额外 feature、`optional` 与
`default-features` 覆盖。path 依赖会重算为相对 workspace 根的路径。若已有 workspace 条目会被更新，请
留意 diff 中受影响的现有继承者。

**统一为继承**：在依赖体检中把绕过已有 `[workspace.dependencies]` 的声明改为 `workspace = true`，并保留
成员额外配置。版本范围不兼容时会拒绝，或在所有直接声明一致时提供“更新 workspace 约束”的确认，不会静默
改变语义。

### Cargo 镜像

工具链视图提供 **Cargo mirror** 节点和标题栏操作，用于切换 Rust Forge 使用的注册表。内置选项（URL 均已
对照镜像文档核实）：

| 镜像 | 索引 |
|---|---|
| 官方 crates.io | Cargo 默认；不注入任何替换 |
| 清华 TUNA | `sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/` |
| 阿里云 | `sparse+https://mirrors.aliyun.com/crates.io-index/` |
| 中科大 | `sparse+https://mirrors.ustc.edu.cn/crates.io-index/` |
| RsProxy | `sparse+https://rsproxy.cn/index/` |

也可以添加自定义 sparse 或 git 索引；名称必须唯一，URL 中不允许携带凭据。镜像通过 cargo 全局
`--config` 参数**只作用于 Rust Forge 启动的进程**；`cargo install` 还会额外使用 `--index`，因为它不会对
被安装的 crate 应用 source replacement。扩展从不写入 `~/.cargo/config.toml`，因此在 VS Code 之外启动的
构建仍使用你原有的配置。

`official` 表示“不注入替换”：如果全局 Cargo 配置里已经有镜像，Rust Forge 会继续沿用。切换到其他镜像可能
导致一次性的索引/依赖重新下载（Cargo 按 source identity 缓存）。Rust Forge 自身的 crates.io 元数据与安全
公告查询不受镜像设置影响。

### 安全模型

- 每次清单写入都经过**保留格式的 TOML 编辑器**：注释、顺序和空白都会保留。
- 写入后都会进行校验（`cargo metadata --no-deps`，以及在相关场景下的 `cargo check` / `fmt --check` / `clippy`）。
- 破坏性操作（升级、成员移动、提升/收敛、转换、标准化）先展示 diff，写入后再校验。
- 成员移动会先对清单和目录做内部快照；应用过程中失败会自动恢复原布局。与其他操作一样，没有面向用户的
  回滚命令。
- 镜像选择只作为 cargo 进程参数传递，不会创建或修改任何 Cargo 配置文件。

## 快速开始

1. 打开包含 `Cargo.toml` 的文件夹，或运行 **Rust Forge: Create Rust Project**。
2. 打开活动栏中的 Rust Forge 图标。
3. 项目视图标题栏提供工作区拓扑、属性、rustfmt、标准化与转换；依赖视图标题栏提供安装、
   **审查安全升级** 与依赖体检；工具链视图标题栏提供工具链更新与 **Cargo 镜像** 选择。

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
| `rustForge.cargoMirror` | `official` | Rust Forge cargo 命令使用的镜像源：`official`、`tuna`、`aliyun`、`ustc`、`rsproxy` 或 `custom:<name>`。 |
| `rustForge.cargoMirrors` | `[]` | 从工具链视图添加的自定义镜像（`{ "name", "index" }`）。 |

镜像仅以 cargo `--config source.crates-io.replace-with=...` 参数注入到 Rust Forge 启动的进程
（metadata、check、update、clippy，以及 Run/Run Tests 终端）。由于 `cargo install` 不会对被安装的 crate
应用 source replacement，install 命令还会通过 `--index` 接收所选索引。扩展不会写入
`~/.cargo/config.toml`，因此在 VS Code 之外启动的构建仍使用你原有的配置。镜像只作用于 cargo；Rust Forge
自身的 crates.io 元数据与安全公告查询仍使用各自的 HTTPS 接口。

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
- `cargo update --precise` 仅用于“只刷新锁文件”的场景；需要重写版本约束时使用 `cargo update -p <name>`，由 Cargo 在新约束内自行解析。
- 移动成员只重写 Cargo 清单；CI、脚本、Dockerfile 或文档中的路径引用会以提示形式报告，不会自动修改。
- 选择 `official` 不会清除全局 Cargo 配置里已有的镜像；需要覆盖时请选择具体镜像。
- 切换镜像可能触发一次性的索引/依赖下载；Rust Forge 自身的 crates.io 元数据与安全公告查询不走镜像，
  自定义镜像表单也不支持需要认证的私有注册表。
