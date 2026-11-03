import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { renderShell, WebviewPanelHost } from '../../webviews/host.js';
import { DependencyTreeProvider } from '../../views/dependencyTree.js';
import { ProjectTreeProvider } from '../../views/projectTree.js';
import { ToolchainTreeProvider } from '../../views/toolchainTree.js';

/**
 * Integration checks that run inside a real Extension Development Host.
 * Each test asserts externally observable behaviour: commands registered and
 * panels opening without throwing.
 */
export async function run(): Promise<void> {
  const results: { name: string; ok: boolean; message?: string }[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, message: (err as Error).message });
    }
  };

  await test('extension activates and commands are registered', async () => {
    const extension = vscode.extensions.getExtension('rust-forge.rust-forge');
    assert.ok(extension, 'extension not found');
    await extension.activate();
    assert.ok(extension.isActive, 'extension did not activate');
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      'rustForge.createProject',
      'rustForge.createSinglePackage',
      'rustForge.createWorkspace',
      'rustForge.installDependency',
      'rustForge.upgradeDependencies',
      'rustForge.workspaceTopology',
      'rustForge.moveMember',
      'rustForge.promoteDependencyToWorkspace',
      'rustForge.editProperties',
      'rustForge.editRustfmt',
      'rustForge.standardize',
      'rustForge.convertToWorkspace',
      'rustForge.refresh',
      'rustForge.openCrateDocs',
      'rustForge.removeDependency',
      'rustForge.files.newFile',
      'rustForge.files.newFolder',
      'rustForge.files.rename',
      'rustForge.files.delete',
      'rustForge.files.copyPath',
      'rustForge.files.copyRelativePath',
      'rustForge.files.revealInOS',
      'rustForge.files.openToSide',
      'rustForge.files.refresh',
      'rustForge.runTest',
      'rustForge.run',
      'rustForge.dependencyHealth',
      'rustForge.selectCargoMirror',
      'rustForge.addCargoMirror',
      'rustForge.removeCargoMirror',
    ]) {
      assert.ok(commands.includes(id), `${id} is not registered`);
    }
  });

  await test('webview shell installs the message bridge', async () => {
    const extension = vscode.extensions.getExtension('rust-forge.rust-forge')!;
    const panel = vscode.window.createWebviewPanel(
      'rustForge.test',
      'Rust Forge test',
      vscode.ViewColumn.Active,
      { enableScripts: true },
    );
    try {
      const html = renderShell(panel.webview, extension.extensionUri, 'test');
      assert.match(html, /window\.rustForge/);
      assert.match(html, /acquireVsCodeApi/);
      assert.match(html, /post:/);
    } finally {
      panel.dispose();
    }
  });

  await test('workspace dependency groups render with local/remote sections', async () => {
    const dep = (kind: 'path' | 'registry', name: string, localTarget?: string) => ({
      kind: localTarget ? 'localDependency' : 'dependency',
      id: `workspace-dep:${name}`,
      label: name,
      advisories: [],
      workspaceRootDependency: true,
      localTarget,
      declaration: { kind, packageName: name, key: name, table: 'dependencies', tablePath: 'workspace.dependencies', features: [], rawValue: '""', manifestPath: '/tmp/ws/Cargo.toml', line: 0 },
    });
    const pinned = {
      kind: 'group',
      id: 'workspace-dependencies',
      label: 'Workspace dependencies',
      description: '2',
      advisories: [],
      icon: 'library',
      children: [
        {
          kind: 'group',
          id: 'workspace-deps:local',
          label: 'Local dependencies',
          description: '1',
          advisories: [],
          icon: 'folder-library',
          children: [dep('path', 'inner', 'inner')],
        },
        {
          kind: 'group',
          id: 'workspace-deps:remote',
          label: 'Remote dependencies',
          description: '1',
          advisories: [],
          icon: 'cloud',
          children: [dep('registry', 'serde')],
        },
      ],
    };
    const root = {
      kind: 'workspace',
      id: 'workspace:/tmp/ws',
      label: 'ws',
      advisories: [],
      children: [pinned, { kind: 'member', id: 'member:app', label: 'app', advisories: [], children: [] }],
    };
    const provider = new DependencyTreeProvider({ snapshot: { depTree: { root } } } as never);
    const rootElement = (provider.getChildren() as never[])[0];
    assert.ok(rootElement, 'workspace root is missing');
    const rootItem = provider.getTreeItem(rootElement);
    assert.equal(rootItem.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);

    const sections = provider.getChildren(rootElement) as never[];
    const pinnedElement = sections.find((element) => (element as { node: { id: string } }).node.id === 'workspace-dependencies');
    assert.ok(pinnedElement, 'workspace dependency group is missing');
    const pinnedItem = provider.getTreeItem(pinnedElement);
    assert.equal(pinnedItem.contextValue, 'workspace-dependencies');
    assert.ok(String(pinnedItem.label).includes('Workspace'));

    const groups = provider.getChildren(pinnedElement) as never[];
    const local = groups.find((element) => (element as { node: { id: string } }).node.id === 'workspace-deps:local');
    const remote = groups.find((element) => (element as { node: { id: string } }).node.id === 'workspace-deps:remote');
    assert.ok(local && remote, 'local/remote groups are missing');
    assert.equal(provider.getTreeItem(local).contextValue, 'workspace-deps:local');
    assert.equal(provider.getTreeItem(remote).contextValue, 'workspace-deps:remote');

    const remoteDeps = provider.getChildren(remote) as never[];
    assert.equal(remoteDeps.length, 1);
    assert.match(String(provider.getTreeItem(remoteDeps[0]).contextValue), /workspaceRootDependency/);
  });

  await test('views show loading and error rows instead of the create-project welcome', async () => {
    const loading = { phase: 'loading', errors: [] } as never;

    const deps = new DependencyTreeProvider(loading);
    const depRows = deps.getChildren() as never[];
    assert.equal(depRows.length, 1, 'dependency view should show exactly one loading row');
    const depItem = deps.getTreeItem(depRows[0]);
    assert.equal(depItem.contextValue, 'status:loading');
    assert.equal(depItem.collapsibleState, vscode.TreeItemCollapsibleState.None);

    const toolchain = new ToolchainTreeProvider(loading);
    const tcRows = toolchain.getChildren() as never[];
    assert.equal(tcRows.length, 1, 'toolchain view should show exactly one loading row');
    assert.equal(toolchain.getTreeItem(tcRows[0]).contextValue, 'status:loading');

    const failed = new DependencyTreeProvider({ phase: 'error', errors: ['manifest is invalid'] } as never);
    const failedRows = failed.getChildren() as never[];
    assert.equal(failedRows.length, 1, 'failed view should show an error row');
    const failedItem = failed.getTreeItem(failedRows[0]);
    assert.equal(failedItem.contextValue, 'status:error');
    assert.equal(failedItem.command?.command, 'rustForge.refresh');
    assert.match(String(failedItem.tooltip), /manifest is invalid/);
  });

  await test('project views are contributed', async () => {
    const pkg = vscode.extensions.getExtension('rust-forge.rust-forge')!.packageJSON as {
      contributes: {
        views: Record<string, { id: string }[]>;
        keybindings?: { command: string; key: string; when?: string }[];
      };
    };
    const ids = pkg.contributes.views.rustForge.map((view) => view.id);
    assert.deepEqual(ids.sort(), [
      'rustForge.dependencies',
      'rustForge.project',
      'rustForge.toolchain',
    ]);
    // The toolchain view is the last one in the container.
    assert.equal(pkg.contributes.views.rustForge.at(-1)?.id, 'rustForge.toolchain');

    const keybindings = pkg.contributes.keybindings ?? [];
    assert.ok(
      keybindings.some(
        (binding) =>
          binding.command === 'rustForge.files.rename' &&
          binding.key === 'f2' &&
          binding.when?.includes('focusedView == rustForge.project'),
      ),
      'F2 rename is not bound to the project view',
    );
    assert.ok(
      keybindings.some(
        (binding) =>
          binding.command === 'rustForge.files.rename' && binding.key === 'enter' && binding.when?.includes('isMac'),
      ),
      'macOS Enter rename is not bound to the project view',
    );
  });

  await test('project view contributes create/open actions for non-project folders', async () => {
    const pkg = vscode.extensions.getExtension('rust-forge.rust-forge')!.packageJSON as {
      contributes: { viewsWelcome: { view: string; when?: string }[] };
    };
    const projectWelcome = pkg.contributes.viewsWelcome.filter((entry) => entry.view === 'rustForge.project');
    const stateOf = (name: string) =>
      projectWelcome.find((entry) => entry.when?.includes(`rustForge.folderState == '${name}'`));
    assert.ok(stateOf('empty'), 'the empty-folder initialization welcome is missing');
    assert.ok(stateOf('nonRust'), 'the non-Rust create/open welcome is missing');
    assert.ok(stateOf('noFolder'), 'the no-folder welcome is missing');
  });

  await test('project tree stays empty without a root manifest instead of listing files', async () => {
    const provider = new ProjectTreeProvider({ project: undefined, snapshot: undefined, phase: 'idle', errors: [] } as never);
    try {
      assert.deepEqual(await provider.getChildren(), []);
    } finally {
      provider.dispose();
    }
  });
  await test('toolchain view exposes the cargo mirror selector', async () => {
    const provider = new ToolchainTreeProvider({
      phase: 'ready',
      errors: [],
      snapshot: {
        toolchain: {
          installed: [],
          updates: [],
          msrvRelation: 'unknown',
        },
      },
    } as never);
    const nodes = provider.getChildren() as never[];
    const mirror = nodes.find((node) => (node as { contextValue?: string }).contextValue === 'cargoMirror');
    assert.ok(mirror, 'cargo mirror node is missing');
    const item = provider.getTreeItem(mirror);
    assert.equal(item.contextValue, 'cargoMirror');
    assert.equal(item.command?.command, 'rustForge.selectCargoMirror');
  });

  await test('files view refreshes without throwing', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.rustForge');
    await vscode.commands.executeCommand('rustForge.files.refresh');
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

  await test('project tree lists the package root files', async () => {
    const manifestPath = '/tmp/rfdemo/Cargo.toml';
    const provider = new ProjectTreeProvider({
      project: {
        kind: 'package',
        root: '/tmp/rfdemo',
        manifestPath,
        members: [],
        rootPackage: { name: 'rfdemo', dir: '/tmp/rfdemo', manifestPath },
        emptyWorkspaceShell: false,
      },
      snapshot: undefined,
    } as never);
    try {
      const root = (await provider.getChildren())[0];
      assert.ok(root, 'root element is missing');
      assert.equal(root.label, 'rfdemo');
      const children = await provider.getChildren(root);
      const src = children.find((entry) => entry.label === 'src');
      assert.ok(src, 'src folder is missing');
      assert.ok(children.some((entry) => entry.label === 'Cargo.toml'), 'root manifest is missing');
    } finally {
      provider.dispose();
    }
  });

  await test('project tree merges members without the crates grouping folder', async () => {
    const dir = '/tmp/rf-merged-ws';
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(path.join(dir, 'crates', 'app', 'src'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/app"]\nresolver = "3"\n',
      'utf8',
    );
    await fs.writeFile(path.join(dir, '.gitignore'), 'target\n', 'utf8');
    await fs.writeFile(path.join(dir, 'crates', 'app', 'Cargo.toml'), '[package]\nname = "app"\nversion = "0.1.0"\n', 'utf8');
    await fs.writeFile(path.join(dir, 'crates', 'app', 'src', 'lib.rs'), '', 'utf8');

    const root = vscode.Uri.file(dir).fsPath;
    const provider = new ProjectTreeProvider({
      project: {
        kind: 'workspace',
        root,
        manifestPath: path.join(root, 'Cargo.toml'),
        members: [
          {
            name: 'app',
            dir: path.join(root, 'crates', 'app'),
            manifestPath: path.join(root, 'crates', 'app', 'Cargo.toml'),
          },
        ],
        emptyWorkspaceShell: false,
      },
      snapshot: undefined,
    } as never);
    try {
      const rootNode = (await provider.getChildren())[0];
      assert.ok(rootNode, 'workspace root is missing');
      const children = await provider.getChildren(rootNode);
      const labels = children.map((entry) => entry.label);
      assert.equal(labels[0], 'app', 'members should be listed first');
      assert.ok(!labels.includes('crates'), 'the crates grouping folder should be hidden');
      assert.ok(labels.includes('.gitignore'), 'root-level files are missing');
      assert.ok(labels.includes('Cargo.toml'), 'root manifest is missing');

      const member = children.find((entry) => entry.label === 'app');
      assert.ok(member, 'workspace member is missing');
      const memberLabels = (await provider.getChildren(member)).map((entry) => entry.label);
      assert.ok(memberLabels.includes('Cargo.toml'), 'member manifest is missing');
      assert.ok(memberLabels.includes('src'), 'member src folder is missing');
      assert.ok(!memberLabels.includes('crates'), 'member contents should expand in place');
    } finally {
      provider.dispose();
    }
  });

  await test('files move on drop but crate roots do not', async () => {
    const dir = '/tmp/rf-dnd';
    const exists = async (file: string) => {
      try {
        await fs.stat(file);
        return true;
      } catch {
        return false;
      }
    };
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(path.join(dir, 'crates', 'app'), { recursive: true });
    await fs.writeFile(path.join(dir, 'Cargo.toml'), '[workspace]\nmembers = ["crates/app"]\n', 'utf8');
    await fs.writeFile(
      path.join(dir, 'crates', 'app', 'Cargo.toml'),
      '[package]\nname = "app"\nversion = "0.1.0"\n',
      'utf8',
    );
    await fs.writeFile(path.join(dir, 'README.md'), 'hello', 'utf8');

    const root = vscode.Uri.file(dir);
    const memberUri = vscode.Uri.file(path.join(dir, 'crates', 'app'));
    const provider = new ProjectTreeProvider({
      project: {
        kind: 'workspace',
        root: dir,
        manifestPath: path.join(dir, 'Cargo.toml'),
        members: [
          {
            name: 'app',
            dir: memberUri.fsPath,
            manifestPath: path.join(memberUri.fsPath, 'Cargo.toml'),
          },
        ],
        emptyWorkspaceShell: false,
      },
      snapshot: undefined,
      phase: 'ready',
      errors: [],
    } as never);
    try {
      const source = vscode.Uri.file(path.join(dir, 'README.md'));
      const transfer = new vscode.DataTransfer();
      provider.handleDrag(
        [{ kind: 'file', label: 'README.md', resourceUri: source } as never],
        transfer,
      );
      assert.ok(transfer.get('application/vnd.code.tree.rustforge.project'), 'files should be draggable');

      const memberDrag = new vscode.DataTransfer();
      provider.handleDrag(
        [{ kind: 'member', label: 'app', resourceUri: memberUri } as never],
        memberDrag,
      );
      assert.equal(
        memberDrag.get('application/vnd.code.tree.rustforge.project'),
        undefined,
        'crate roots should not be draggable',
      );

      await provider.handleDrop(
        { kind: 'member', label: 'app', resourceUri: memberUri } as never,
        transfer,
        new vscode.CancellationTokenSource().token,
      );
      assert.ok(await exists(path.join(memberUri.fsPath, 'README.md')), 'dropped file is missing');
      assert.ok(!(await exists(source.fsPath)), 'the source file should have moved');

      // Even when a crate directory arrives as an external uri-list drop, it is
      // not a valid drag source.
      const memberTransfer = new vscode.DataTransfer();
      memberTransfer.set('text/uri-list', new vscode.DataTransferItem(memberUri.toString()));
      await provider.handleDrop(
        { kind: 'root', label: 'ws', resourceUri: root } as never,
        memberTransfer,
        new vscode.CancellationTokenSource().token,
      );
      assert.ok(await exists(path.join(memberUri.fsPath, 'Cargo.toml')), 'a crate root must stay in place');
    } finally {
      provider.dispose();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  await test('refresh loads the sample project', async () => {
    await vscode.commands.executeCommand('rustForge.refresh');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  for (const [command, wait] of [
    ['rustForge.installDependency', 1500],
    ['rustForge.upgradeDependencies', 1500],
    ['rustForge.editProperties', 1500],
    ['rustForge.editRustfmt', 1500],
    ['rustForge.standardize', 1500],
    ['rustForge.convertToWorkspace', 2000],
    ['rustForge.dependencyHealth', 2500],
    ['rustForge.workspaceTopology', 1500],
  ] as [string, number][]) {
    await test(`${command} opens without throwing`, async () => {
      await vscode.commands.executeCommand(command);
      await new Promise((resolve) => setTimeout(resolve, wait));
    });
  }

  await test('cargo.toml is still valid after opening every panel', async () => {
    const manifest = await fs.readFile('/tmp/rfdemo/Cargo.toml', 'utf8');
    assert.match(manifest, /name = "rfdemo"/);
    const editor = await vscode.workspace.openTextDocument(vscode.Uri.file('/tmp/rfdemo/Cargo.toml'));
    assert.ok(editor.getText().length > 0);
  });

  await test('panels are singletons and refresh from watched files', async () => {
    const dir = await fs.realpath('/tmp/rf-panel-watch').catch(async () => {
      await fs.mkdir('/tmp/rf-panel-watch', { recursive: true });
      return fs.realpath('/tmp/rf-panel-watch');
    });
    const watched = path.join(dir, 'Cargo.toml');
    const version = (value: string) => `[package]\nname = "watch"\nversion = "${value}"\n`;
    await fs.writeFile(watched, version('0.1.0'), 'utf8');

    const extensionUri = vscode.extensions.getExtension('rust-forge.rust-forge')!.extensionUri;
    const data = { kind: 'standardize-panel' as const, workspace: false, findings: [] };
    let reloads = 0;
    const options = () => ({
      extensionUri,
      id: 'test-watch',
      title: 'Rust Forge watch test',
      data,
      watch: [watched],
      reload: () => {
        reloads += 1;
        return data;
      },
      handlers: () => {},
    });

    const first = WebviewPanelHost.create(options());
    const second = WebviewPanelHost.create(options());
    try {
      assert.equal(second, first, 're-opening a live panel must reuse the tab');
      // Give the OS watcher a moment to attach before touching the file.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await fs.writeFile(watched, version('0.2.0'), 'utf8');
      for (let attempt = 0; attempt < 20 && reloads === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.ok(reloads > 0, 'a watched file change did not refresh the panel');
    } finally {
      first.dispose();
      second.dispose();
    }

    const before = reloads;
    await fs.writeFile(watched, version('0.3.0'), 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    assert.equal(reloads, before, 'a disposed panel must stop watching files');
  });

  const failures = results.filter((result) => !result.ok);
  const summary = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.message ? `: ${r.message}` : ''}`).join('\n');
  try {
    await fs.writeFile(path.join('/tmp', 'rf-integration-results.txt'), summary, 'utf8');
  } catch {
    // Ignore write failures; the thrown error below is what matters.
  }
  if (failures.length) {
    throw new Error(`${failures.length} test(s) failed:\n${summary}`);
  }
  console.log(summary);
}
