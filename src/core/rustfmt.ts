/** rustfmt.toml option metadata, reading and writing with comment preservation. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fileExists, readTextFile } from './process.js';
import { TomlEditor } from './toml/editor.js';

export type RustfmtValueType = 'boolean' | 'number' | 'string' | 'enum' | 'array';

export interface RustfmtOption {
  key: string;
  /** Short human-facing name for form controls. */
  label: string;
  labelZh: string;
  type: RustfmtValueType;
  description: string;
  descriptionZh: string;
  default?: string | number | boolean | string[];
  values?: string[];
  /** Stable-only options can be written without a nightly toolchain. */
  stable: boolean;
  min?: number;
  max?: number;
  category: 'layout' | 'comments' | 'imports' | 'heuristics' | 'style' | 'unstable';
}

/**
 * Curated option list. Unstable options are visible but flagged, because a
 * stable rustfmt ignores them (or warns) unless unstable_features is enabled.
 */
export const RUSTFMT_OPTIONS: RustfmtOption[] = [
  {
    key: 'max_width',
    label: 'Maximum line width',
    labelZh: '最大行宽',
    type: 'number',
    description: 'Maximum line width before rustfmt wraps.',
    descriptionZh: '换行前允许的最大行宽。',
    default: 100,
    min: 40,
    max: 240,
    stable: true,
    category: 'layout',
  },
  {
    key: 'hard_tabs',
    label: 'Use tabs for indentation',
    labelZh: '使用制表符缩进',
    type: 'boolean',
    description: 'Use tab characters instead of spaces.',
    descriptionZh: '使用制表符而非空格缩进。',
    default: false,
    stable: true,
    category: 'layout',
  },
  {
    key: 'tab_spaces',
    label: 'Spaces per indent',
    labelZh: '每级缩进空格数',
    type: 'number',
    description: 'Spaces per indentation level.',
    descriptionZh: '每级缩进的空格数。',
    default: 4,
    min: 1,
    max: 16,
    stable: true,
    category: 'layout',
  },
  {
    key: 'newline_style',
    label: 'Line endings',
    labelZh: '换行符风格',
    type: 'enum',
    description: 'Line ending style.',
    descriptionZh: '换行符风格。',
    values: ['Auto', 'Unix', 'Windows', 'Native'],
    stable: true,
    category: 'layout',
  },
  {
    key: 'indent_style',
    label: 'Indent style',
    labelZh: '缩进风格',
    type: 'enum',
    description: 'Block indentation or visual alignment.',
    descriptionZh: '块缩进或视觉对齐。',
    values: ['Block', 'Visual'],
    default: 'Block',
    stable: false,
    category: 'layout',
  },
  {
    key: 'edition',
    label: 'Edition',
    labelZh: 'Edition',
    type: 'enum',
    description: 'Edition used when parsing source files.',
    descriptionZh: '解析源码时使用的 edition。',
    values: ['2015', '2018', '2021', '2024'],
    stable: true,
    category: 'layout',
  },
  {
    key: 'style_edition',
    label: 'Style edition',
    labelZh: '风格 edition',
    type: 'enum',
    description: 'Style edition used for formatting rules.',
    descriptionZh: '应用格式化规则时使用的风格 edition。',
    values: ['2015', '2018', '2021', '2024'],
    stable: true,
    category: 'layout',
  },
  {
    key: 'fn_params_layout',
    label: 'Function parameter layout',
    labelZh: '函数参数布局',
    type: 'enum',
    description: 'How long function parameter lists are laid out.',
    descriptionZh: '较长的函数参数列表的布局方式。',
    values: ['Tall', 'Compressed', 'Vertical'],
    default: 'Tall',
    stable: true,
    category: 'layout',
  },
  {
    key: 'use_small_heuristics',
    label: 'Single-line heuristics',
    labelZh: '单行紧凑启发式',
    type: 'enum',
    description: 'How aggressively to keep things on one line.',
    descriptionZh: '单行紧凑程度的启发式策略。',
    values: ['Default', 'Off', 'Max'],
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'fn_call_width',
    label: 'Function call width',
    labelZh: '函数调用宽度',
    type: 'number',
    description: 'Maximum width of a single-line function call.',
    descriptionZh: '单行函数调用的最大宽度。',
    default: 60,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'attr_fn_like_width',
    label: 'Attribute-like width',
    labelZh: '属性式宏宽度',
    type: 'number',
    description: 'Maximum width of attribute-like invocations.',
    descriptionZh: '属性式宏调用允许的最大宽度。',
    default: 70,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'struct_lit_width',
    label: 'Struct literal width',
    labelZh: '结构体字面量宽度',
    type: 'number',
    description: 'Maximum single-line width for struct literals.',
    descriptionZh: '结构体字面量单行的最大宽度。',
    default: 18,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'struct_variant_width',
    label: 'Struct variant width',
    labelZh: '结构体变体宽度',
    type: 'number',
    description: 'Maximum single-line width for struct variants.',
    descriptionZh: '结构体变体单行的最大宽度。',
    default: 35,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'array_width',
    label: 'Array width',
    labelZh: '数组宽度',
    type: 'number',
    description: 'Maximum single-line width for arrays.',
    descriptionZh: '数组单行的最大宽度。',
    default: 60,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'chain_width',
    label: 'Method chain width',
    labelZh: '方法链宽度',
    type: 'number',
    description: 'Maximum single-line width for method chains.',
    descriptionZh: '方法链单行的最大宽度。',
    default: 60,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'single_line_if_else_max_width',
    label: 'Single-line if/else width',
    labelZh: '单行 if/else 宽度',
    type: 'number',
    description: 'Maximum width for a single-line if/else expression.',
    descriptionZh: '单行 if/else 表达式的最大宽度。',
    default: 50,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'single_line_let_else_max_width',
    label: 'Single-line let/else width',
    labelZh: '单行 let/else 宽度',
    type: 'number',
    description: 'Maximum width for a single-line let/else expression.',
    descriptionZh: '单行 let/else 表达式的最大宽度。',
    default: 50,
    min: 1,
    max: 240,
    stable: true,
    category: 'heuristics',
  },
  {
    key: 'wrap_comments',
    label: 'Wrap comments',
    labelZh: '自动换行注释',
    type: 'boolean',
    description: 'Wrap comments that exceed comment_width.',
    descriptionZh: '对超过 comment_width 的注释自动换行。',
    default: false,
    stable: false,
    category: 'comments',
  },
  {
    key: 'comment_width',
    label: 'Comment width',
    labelZh: '注释宽度',
    type: 'number',
    description: 'Maximum line width for comments when wrapping is enabled.',
    descriptionZh: '启用注释换行后的最大行宽。',
    default: 80,
    min: 20,
    max: 240,
    stable: false,
    category: 'comments',
  },
  {
    key: 'normalize_comments',
    label: 'Normalize comments',
    labelZh: '规范化注释',
    type: 'boolean',
    description: 'Convert /* */ comments to // where possible.',
    descriptionZh: '在可行时把 /* */ 注释转换为 //。',
    default: false,
    stable: false,
    category: 'comments',
  },
  {
    key: 'normalize_doc_attributes',
    label: 'Normalize doc attributes',
    labelZh: '规范化文档属性',
    type: 'boolean',
    description: 'Convert #![doc] attributes to /// doc comments.',
    descriptionZh: '把 #![doc] 属性转换为 /// 文档注释。',
    default: false,
    stable: false,
    category: 'comments',
  },
  {
    key: 'format_code_in_doc_comments',
    label: 'Format code in doc comments',
    labelZh: '格式化文档注释中的代码',
    type: 'boolean',
    description: 'Format Rust code blocks inside doc comments.',
    descriptionZh: '格式化文档注释中的 Rust 代码块。',
    default: false,
    stable: false,
    category: 'comments',
  },
  {
    key: 'doc_comment_code_block_width',
    label: 'Doc code block width',
    labelZh: '文档代码块宽度',
    type: 'number',
    description: 'Maximum width of code blocks inside doc comments.',
    descriptionZh: '文档注释内代码块的最大宽度。',
    default: 100,
    min: 40,
    max: 240,
    stable: false,
    category: 'comments',
  },
  {
    key: 'format_strings',
    label: 'Format string literals',
    labelZh: '格式化字符串字面量',
    type: 'boolean',
    description: 'Break and format string literals.',
    descriptionZh: '拆分并格式化字符串字面量。',
    default: false,
    stable: false,
    category: 'comments',
  },
  {
    key: 'reorder_imports',
    label: 'Sort and merge imports',
    labelZh: '排序并合并 imports',
    type: 'boolean',
    description: 'Sort and merge import statements.',
    descriptionZh: '排序并合并 import 语句。',
    default: true,
    stable: true,
    category: 'imports',
  },
  {
    key: 'reorder_modules',
    label: 'Sort module declarations',
    labelZh: '排序 module 声明',
    type: 'boolean',
    description: 'Sort module declarations.',
    descriptionZh: '排序 module 声明。',
    default: true,
    stable: true,
    category: 'imports',
  },
  {
    key: 'imports_granularity',
    label: 'Imports granularity',
    labelZh: 'import 分组粒度',
    type: 'enum',
    description: 'How imports are grouped: one per crate, module, or item.',
    descriptionZh: 'import 分组粒度：按 crate、模块或逐项。',
    values: ['Preserve', 'Crate', 'Module', 'Item', 'One'],
    stable: false,
    category: 'imports',
  },
  {
    key: 'group_imports',
    label: 'Group imports',
    labelZh: 'import 分组方式',
    type: 'enum',
    description: 'Group imports by standard library, external crates and local.',
    descriptionZh: '按标准库、外部 crate、本地模块分组 import。',
    values: ['Preserve', 'StdExternalCrate', 'One'],
    stable: false,
    category: 'imports',
  },
  {
    key: 'imports_layout',
    label: 'Imports layout',
    labelZh: 'import 布局',
    type: 'enum',
    description: 'Layout for imports that span multiple lines.',
    descriptionZh: '跨行 import 的布局方式。',
    values: ['Mixed', 'Horizontal', 'HorizontalVertical', 'Vertical'],
    default: 'Mixed',
    stable: false,
    category: 'imports',
  },
  {
    key: 'imports_indent',
    label: 'Imports indent',
    labelZh: 'import 缩进',
    type: 'enum',
    description: 'Indent style for multi-line imports.',
    descriptionZh: '跨行 import 的缩进方式。',
    values: ['Block', 'Visual'],
    default: 'Block',
    stable: false,
    category: 'imports',
  },
  {
    key: 'reorder_impl_items',
    label: 'Sort impl items',
    labelZh: '排序 impl 项',
    type: 'boolean',
    description: 'Sort items inside impl blocks by kind.',
    descriptionZh: '按类型排序 impl 块中的项。',
    default: false,
    stable: false,
    category: 'imports',
  },
  {
    key: 'remove_nested_parens',
    label: 'Remove nested parentheses',
    labelZh: '移除嵌套括号',
    type: 'boolean',
    description: 'Remove redundant nested parentheses.',
    descriptionZh: '移除多余嵌套括号。',
    default: true,
    stable: true,
    category: 'style',
  },
  {
    key: 'merge_derives',
    label: 'Merge derive attributes',
    labelZh: '合并 derive 属性',
    type: 'boolean',
    description: 'Merge multiple derive attributes into one.',
    descriptionZh: '把多个 derive 属性合并为一个。',
    default: true,
    stable: true,
    category: 'style',
  },
  {
    key: 'use_try_shorthand',
    label: 'Use ? shorthand',
    labelZh: '使用 ? 简写',
    type: 'boolean',
    description: 'Replace try!(expr) with expr?.',
    descriptionZh: '把 try!(expr) 替换为 expr?。',
    default: false,
    stable: true,
    category: 'style',
  },
  {
    key: 'use_field_init_shorthand',
    label: 'Use field init shorthand',
    labelZh: '使用字段初始化简写',
    type: 'boolean',
    description: 'Use Foo { field } instead of Foo { field: field }.',
    descriptionZh: '使用 Foo { field }，而不是 Foo { field: field }。',
    default: false,
    stable: true,
    category: 'style',
  },
  {
    key: 'force_explicit_abi',
    label: 'Force explicit ABI',
    labelZh: '强制显式 ABI',
    type: 'boolean',
    description: 'Always print extern "C" instead of extern.',
    descriptionZh: '始终写出 extern "C"，而不是裸 extern。',
    default: true,
    stable: true,
    category: 'style',
  },
  {
    key: 'spaces_around_ranges',
    label: 'Spaces around ranges',
    labelZh: 'range 两侧空格',
    type: 'boolean',
    description: 'Put spaces around range operators.',
    descriptionZh: '在 range 运算符两侧添加空格。',
    default: false,
    stable: false,
    category: 'style',
  },
  {
    key: 'binop_separator',
    label: 'Binary operator position',
    labelZh: '二元运算符位置',
    type: 'enum',
    description: 'Put binary operators at the front or back of a broken line.',
    descriptionZh: '换行时把二元运算符放在行首或行尾。',
    values: ['Front', 'Back'],
    default: 'Front',
    stable: false,
    category: 'style',
  },
  {
    key: 'trailing_comma',
    label: 'Trailing commas',
    labelZh: '尾随逗号',
    type: 'enum',
    description: 'When to put trailing commas in lists.',
    descriptionZh: '列表尾随逗号的添加时机。',
    values: ['Vertical', 'Always', 'Never'],
    default: 'Vertical',
    stable: false,
    category: 'style',
  },
  {
    key: 'match_block_trailing_comma',
    label: 'Trailing comma after match blocks',
    labelZh: 'match 块后的尾随逗号',
    type: 'boolean',
    description: 'Put a comma after match arm blocks.',
    descriptionZh: '在 match 分支块后添加逗号。',
    default: false,
    stable: true,
    category: 'style',
  },
  {
    key: 'blank_lines_upper_bound',
    label: 'Maximum blank lines',
    labelZh: '最多空行数',
    type: 'number',
    description: 'Maximum number of consecutive blank lines between items.',
    descriptionZh: '项之间允许的最大连续空行数。',
    default: 1,
    min: 0,
    max: 20,
    stable: false,
    category: 'style',
  },
  {
    key: 'blank_lines_lower_bound',
    label: 'Minimum blank lines',
    labelZh: '最少空行数',
    type: 'number',
    description: 'Minimum number of blank lines between items.',
    descriptionZh: '项之间要求的最小空行数。',
    default: 0,
    min: 0,
    max: 20,
    stable: false,
    category: 'style',
  },
  {
    key: 'fn_single_line',
    label: 'Single-line functions',
    labelZh: '单行函数',
    type: 'boolean',
    description: 'Allow single-expression functions on one line.',
    descriptionZh: '允许单表达式函数写成一行。',
    default: false,
    stable: false,
    category: 'style',
  },
  {
    key: 'match_arm_leading_pipes',
    label: 'Leading pipes in match arms',
    labelZh: 'match 分支前导竖线',
    type: 'enum',
    description: 'Whether match arms start with a leading |.',
    descriptionZh: 'match 分支是否以竖线开头。',
    values: ['Never', 'Always', 'Preserve'],
    default: 'Never',
    stable: true,
    category: 'style',
  },
  {
    key: 'struct_field_align_threshold',
    label: 'Struct field alignment',
    labelZh: '结构体字段对齐',
    type: 'number',
    description: 'Pad struct fields to align their types and defaults.',
    descriptionZh: '填充结构体字段以对齐类型和默认值。',
    default: 0,
    min: 0,
    max: 80,
    stable: false,
    category: 'style',
  },
  {
    key: 'enum_discrim_align_threshold',
    label: 'Enum variant alignment',
    labelZh: '枚举变体对齐',
    type: 'number',
    description: 'Pad enum variants to align their discriminants.',
    descriptionZh: '填充枚举变体以对齐判别值。',
    default: 0,
    min: 0,
    max: 80,
    stable: false,
    category: 'style',
  },
  {
    key: 'format_macro_matchers',
    label: 'Format macro matchers',
    labelZh: '格式化宏匹配器',
    type: 'boolean',
    description: 'Format the matcher part of macro_rules! definitions.',
    descriptionZh: '格式化 macro_rules! 定义中的匹配器部分。',
    default: false,
    stable: false,
    category: 'unstable',
  },
  {
    key: 'format_macro_bodies',
    label: 'Format macro bodies',
    labelZh: '格式化宏主体',
    type: 'boolean',
    description: 'Format the body of macro_rules! definitions.',
    descriptionZh: '格式化 macro_rules! 定义的主体。',
    default: true,
    stable: false,
    category: 'unstable',
  },
  {
    key: 'skip_children',
    label: 'Skip child modules',
    labelZh: '跳过子模块',
    type: 'boolean',
    description: 'Do not format out-of-line child modules automatically.',
    descriptionZh: '不自动格式化外部子模块。',
    default: false,
    stable: false,
    category: 'unstable',
  },
  {
    key: 'format_generated_files',
    label: 'Format generated files',
    labelZh: '格式化生成文件',
    type: 'boolean',
    description: 'Format files containing a generated-code marker.',
    descriptionZh: '格式化包含代码生成标记的文件。',
    default: true,
    stable: false,
    category: 'unstable',
  },
  {
    key: 'ignore',
    label: 'Ignored files',
    labelZh: '忽略文件',
    type: 'array',
    description: 'Comma-separated files or paths rustfmt should skip.',
    descriptionZh: 'rustfmt 应跳过的文件或路径，逗号分隔。',
    default: [],
    stable: false,
    category: 'unstable',
  },
  {
    key: 'unstable_features',
    label: 'Enable unstable options',
    labelZh: '启用不稳定选项',
    type: 'boolean',
    description: 'Enables unstable options (requires nightly rustfmt).',
    descriptionZh: '启用不稳定选项（需要 nightly rustfmt）。',
    default: false,
    stable: false,
    category: 'unstable',
  },
];

export interface RustfmtConfig {
  path?: string;
  values: Record<string, string | number | boolean | string[]>;
  scope: 'workspace' | 'member';
  /** True when the file lives at the workspace root. */
  isWorkspaceRoot: boolean;
  raw?: string;
}

export async function readRustfmtConfig(dir: string): Promise<RustfmtConfig | undefined> {
  for (const name of ['rustfmt.toml', '.rustfmt.toml']) {
    const file = path.join(dir, name);
    if (!(await fileExists(file))) continue;
    try {
      const raw = await readTextFile(file);
      const data = parseToml(raw) as Record<string, unknown>;
      const values: RustfmtConfig['values'] = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          values[key] = value;
        } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
          values[key] = value as string[];
        }
      }
      return { path: file, values, scope: 'workspace', isWorkspaceRoot: true, raw };
    } catch {
      return { path: file, values: {}, scope: 'workspace', isWorkspaceRoot: true };
    }
  }
  return undefined;
}

export interface RustfmtEdit {
  key: string;
  value: string | number | boolean | string[] | undefined;
}

const UNSTABLE_KEYS = new Set(RUSTFMT_OPTIONS.filter((o) => !o.stable).map((o) => o.key));

export function formatRustfmtValue(value: string | number | boolean | string[]): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
}

/** Section order used when generating a fresh rustfmt.toml. */
const SECTION_TITLES: Record<RustfmtOption['category'], { en: string; zh: string }> = {
  layout: { en: 'Layout', zh: '排版' },
  comments: { en: 'Comments', zh: '注释' },
  heuristics: { en: 'Line-breaking heuristics', zh: '换行启发式' },
  imports: { en: 'Imports', zh: 'import 处理' },
  style: { en: 'Style', zh: '风格' },
  unstable: { en: 'Unstable options (nightly rustfmt only)', zh: '不稳定选项（需要 nightly rustfmt）' },
};

export interface GenerateOptions {
  edition?: string;
  maxWidth?: number;
  includeImportsGranularity?: boolean;
  language?: 'en' | 'zh-cn';
  existing?: string;
}

/** Conservative recommended configuration with explanatory comments. */
export function generateRustfmtToml(options: GenerateOptions = {}): string {
  const lang = options.language ?? 'en';
  const zh = lang === 'zh-cn';
  const header = zh
    ? '# rustfmt 配置 —— 由 Rust Forge 生成\n# 仅包含保守选项，不会改变代码语义。\n'
    : '# rustfmt configuration — generated by Rust Forge\n# Conservative options only; none of these change program semantics.\n';

  const lines: string[] = [header.trimEnd(), ''];
  const push = (title: string) => {
    lines.push(`# ${title}`);
  };

  push(zh ? SECTION_TITLES.layout.zh : SECTION_TITLES.layout.en);
  lines.push(`max_width = ${options.maxWidth ?? 100}`);
  lines.push(`tab_spaces = 4`);
  lines.push(`hard_tabs = false`);
  if (options.edition) lines.push(`edition = "${options.edition}"`);
  lines.push('');

  push(zh ? SECTION_TITLES.heuristics.zh : SECTION_TITLES.heuristics.en);
  lines.push(`use_small_heuristics = "Default"`);
  lines.push('');

  push(zh ? SECTION_TITLES.imports.zh : SECTION_TITLES.imports.en);
  lines.push(`reorder_imports = true`);
  if (options.includeImportsGranularity) {
    lines.push(
      zh
        ? '# 需要 nightly rustfmt；稳定版会忽略该项并给出警告。'
        : '# Requires nightly rustfmt; stable rustfmt ignores this with a warning.',
    );
    lines.push(`imports_granularity = "Crate"`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Apply per-option edits to an existing rustfmt.toml (or generate one). */
export function applyRustfmtEdits(existing: string | undefined, edits: RustfmtEdit[], language: 'en' | 'zh-cn' = 'en'): string {
  const source = existing ?? generateRustfmtToml({ language });
  const editor = new TomlEditor(source);
  const collected = edits.map((edit) => {
    if (edit.value === undefined) {
      return editor.removeKey('', edit.key);
    }
    const value = formatRustfmtValue(edit.value);
    if (editor.hasKey('', edit.key)) {
      return editor.setKey('', edit.key, value);
    }
    // Top-level rustfmt options are bare keys before any table.
    const insertAt = topLevelInsertPoint(editor);
    return [{ start: insertAt, end: insertAt, text: `${edit.key} = ${value}${editor.eol}` }];
  });
  const flat = collected.flat();
  if (!flat.length) return source;
  return editor.apply(flat);
}

function topLevelInsertPoint(editor: TomlEditor): number {
  const firstTable = editor.statements.find((s) => s.kind === 'table' || s.kind === 'arrayTable');
  if (firstTable) {
    const text = editor.text.slice(0, firstTable.start);
    const trimmed = text.replace(/\s+$/, '');
    return trimmed.length > 0 ? trimmed.length : 0;
  }
  return editor.text.endsWith('\n') ? editor.text.length : editor.text.length;
}

/** Options whose values differ from the generated defaults. */
export function changedOptions(values: Record<string, unknown>): string[] {
  return RUSTFMT_OPTIONS.filter((option) => option.key in values).map((option) => option.key);
}

/** Warn when unstable options are set without `unstable_features`. */
export function unstableOptionsWithoutFlag(values: Record<string, unknown>): string[] {
  if (values.unstable_features === true) return [];
  return Object.keys(values).filter((key) => UNSTABLE_KEYS.has(key) && key !== 'unstable_features');
}

export function isUnstableOption(key: string): boolean {
  return UNSTABLE_KEYS.has(key);
}

export async function ensureRustfmtFile(root: string, content: string): Promise<string> {
  const file = path.join(root, 'rustfmt.toml');
  if (!(await fileExists(file))) {
    await fs.writeFile(file, content, 'utf8');
  }
  return file;
}

/** Discover rustfmt configs at workspace root and along the member path. */
export async function discoverRustfmtChain(memberDir: string, workspaceRoot: string): Promise<{ path: string; level: 'workspace' | 'member' }[]> {
  const found: { path: string; level: 'workspace' | 'member' }[] = [];
  const workspaceConfig = await readRustfmtConfig(workspaceRoot);
  if (workspaceConfig?.path) found.push({ path: workspaceConfig.path, level: 'workspace' });
  if (path.resolve(memberDir) !== path.resolve(workspaceRoot)) {
    const memberConfig = await readRustfmtConfig(memberDir);
    if (memberConfig?.path) found.push({ path: memberConfig.path, level: 'member' });
  }
  return found;
}
