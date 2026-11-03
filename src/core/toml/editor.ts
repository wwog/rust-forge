/**
 * Format-preserving, line/token-level TOML editor.
 *
 * The extension never rewrites a manifest wholesale: it splices only the
 * statements it actually changes so comments, ordering and whitespace survive.
 * Reading still goes through a real TOML parser elsewhere; this module only
 * needs to understand enough structure to locate and replace statements.
 */

export interface TextEdit {
  start: number;
  end: number;
  text: string;
}

export type StatementKind = 'table' | 'arrayTable' | 'kv' | 'comment' | 'blank' | 'invalid';

export interface Statement {
  kind: StatementKind;
  /** Offset of the first character of the statement. */
  start: number;
  /** Offset just past the last character (newline excluded). */
  end: number;
  /** Raw statement text, newline excluded. */
  raw: string;
  /** Decoded table path parts for headers. */
  tablePath?: string[];
  /** Table name used for lookup (decoded parts joined by '.'). */
  tableName?: string;
  /** Decoded key parts for key/value statements. */
  keyPath?: string[];
  keyRaw?: string;
  valueStart?: number;
  valueEnd?: number;
  valueRaw?: string;
  /** True when this statement is a table header. */
  isArrayTable?: boolean;
}

export interface TableInfo {
  name: string;
  path: string[];
  /** Statement index of the header, or -1 when the table is only implied. */
  headerIndex: number;
  /** Body start offset (right after the header line) or -1. */
  bodyStart: number;
  /** Offset where the next table header starts, or end of document. */
  bodyEnd: number;
  statements: Statement[];
  isArray: boolean;
}

export interface KeyLocation {
  table: TableInfo;
  statement: Statement;
}

export class TomlEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TomlEditError';
  }
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

export function isBareKey(key: string): boolean {
  return BARE_KEY.test(key);
}

export function quoteKey(key: string): string {
  return isBareKey(key) ? key : quoteString(key);
}

export function quoteString(value: string): string {
  // JSON string escaping is a superset of TOML basic-string escaping for the
  // characters we emit (no "/" escaping, no raw control characters).
  return JSON.stringify(value);
}

export function formatKeyPath(parts: string[]): string {
  return parts.map(quoteKey).join('.');
}

interface ScanState {
  mode: 'normal' | 'basic' | 'literal' | 'mlBasic' | 'mlLiteral' | 'comment';
  bracket: number;
  brace: number;
}

export class TomlEditor {
  readonly text: string;
  readonly eol: string;
  readonly statements: Statement[] = [];
  private readonly tables = new Map<string, TableInfo>();

  constructor(text: string) {
    this.text = text;
    this.eol = text.includes('\r\n') ? '\r\n' : '\n';
    this.parse();
  }

  // ---------------------------------------------------------------- parsing

  private parse(): void {
    const text = this.text;
    const state: ScanState = { mode: 'normal', bracket: 0, brace: 0 };
    let statementStart = 0;

    const close = (endExclusive: number) => {
      let end = endExclusive;
      if (end > statementStart && text[end - 1] === '\r') {
        end -= 1;
      }
      this.statements.push(this.classify(statementStart, end));
      statementStart = endExclusive + 1;
    };

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      switch (state.mode) {
        case 'comment':
          if (ch === '\n') {
            state.mode = 'normal';
            if (state.bracket === 0 && state.brace === 0) {
              close(i);
              i += 0;
              statementStart = i + 1;
              continue;
            }
          }
          continue;
        case 'basic':
          if (ch === '\\') {
            i += 1;
          } else if (ch === '"') {
            state.mode = 'normal';
          } else if (ch === '\n') {
            // Unterminated string on one line; recover as normal.
            state.mode = 'normal';
          }
          continue;
        case 'literal':
          if (ch === "'") {
            state.mode = 'normal';
          } else if (ch === '\n') {
            state.mode = 'normal';
          }
          continue;
        case 'mlBasic':
          if (ch === '"' && text.startsWith('"""', i)) {
            state.mode = 'normal';
            i += 2;
            continue;
          }
          if (ch === '\\') {
            i += 1;
          }
          continue;
        case 'mlLiteral':
          if (ch === "'" && text.startsWith("'''", i)) {
            state.mode = 'normal';
            i += 2;
          }
          continue;
        case 'normal':
          break;
      }

      if (ch === '#') {
        state.mode = 'comment';
        continue;
      }
      if (ch === '"') {
        if (text.startsWith('"""', i)) {
          state.mode = 'mlBasic';
          i += 2;
        } else {
          state.mode = 'basic';
        }
        continue;
      }
      if (ch === "'") {
        if (text.startsWith("'''", i)) {
          state.mode = 'mlLiteral';
          i += 2;
        } else {
          state.mode = 'literal';
        }
        continue;
      }
      if (ch === '[') {
        state.bracket += 1;
        continue;
      }
      if (ch === ']') {
        state.bracket = Math.max(0, state.bracket - 1);
        continue;
      }
      if (ch === '{') {
        state.brace += 1;
        continue;
      }
      if (ch === '}') {
        state.brace = Math.max(0, state.brace - 1);
        continue;
      }
      if (ch === '\n') {
        if (state.bracket === 0 && state.brace === 0) {
          close(i);
          statementStart = i + 1;
        }
      }
    }

    if (statementStart < text.length) {
      this.statements.push(this.classify(statementStart, text.length));
    }

    this.buildTableIndex();
  }

  private classify(start: number, end: number): Statement {
    const raw = this.text.slice(start, end);
    const trimmed = raw.trim();

    if (trimmed === '') {
      return { kind: 'blank', start, end, raw };
    }
    if (trimmed.startsWith('#')) {
      return { kind: 'comment', start, end, raw };
    }
    if (trimmed.startsWith('[')) {
      const array = trimmed.startsWith('[[');
      // Ignore a trailing comment: a `]` inside it must not truncate the
      // header and turn an otherwise valid table into an invalid statement.
      const comment = findTrailingComment(this.text, start, end);
      const header = this.text.slice(start, comment < end ? comment : end).trim();
      const close = header.lastIndexOf(array ? ']]' : ']');
      if (close < 0) {
        return { kind: 'invalid', start, end, raw };
      }
      const inner = header.slice(array ? 2 : 1, close);
      const path = parseDottedKey(inner);
      if (!path) {
        return { kind: 'invalid', start, end, raw };
      }
      return {
        kind: array ? 'arrayTable' : 'table',
        start,
        end,
        raw,
        tablePath: path,
        tableName: path.join('.'),
        isArrayTable: array,
      };
    }

    const eq = findTopLevelEquals(raw);
    if (eq < 0) {
      return { kind: 'invalid', start, end, raw };
    }
    const keyRaw = raw.slice(0, eq).trim();
    const keyPath = parseDottedKey(keyRaw);
    if (!keyPath) {
      return { kind: 'invalid', start, end, raw };
    }

    let valueStart = start + eq + 1;
    while (valueStart < end && (this.text[valueStart] === ' ' || this.text[valueStart] === '\t')) {
      valueStart++;
    }
    let valueEnd = findTrailingComment(this.text, valueStart, end);
    while (valueEnd > valueStart && /\s/.test(this.text[valueEnd - 1])) {
      valueEnd--;
    }

    return {
      kind: 'kv',
      start,
      end,
      raw,
      keyPath,
      keyRaw,
      valueStart,
      valueEnd,
      valueRaw: this.text.slice(valueStart, valueEnd),
    };
  }

  private buildTableIndex(): void {
    const root: TableInfo = {
      name: '',
      path: [],
      headerIndex: -1,
      bodyStart: 0,
      bodyEnd: this.text.length,
      statements: [],
      isArray: false,
    };

    let current: TableInfo | undefined = root;
    let pending: TableInfo | undefined;

    for (let i = 0; i < this.statements.length; i++) {
      const stmt = this.statements[i];
      if (stmt.kind === 'table' || stmt.kind === 'arrayTable') {
        if (current === root) {
          root.bodyEnd = stmt.start;
        }
        const info: TableInfo = {
          name: stmt.tableName!,
          path: stmt.tablePath!,
          headerIndex: i,
          bodyStart: lineEndOffset(this.text, stmt.end),
          bodyEnd: this.text.length,
          statements: [],
          isArray: !!stmt.isArrayTable,
        };
        // Keep the first definition for lookup; array tables are indexed with
        // a unique suffix so repeated headers stay addressable.
        if (!this.tables.has(info.name)) {
          this.tables.set(info.name, info);
        } else if (info.isArray) {
          let n = 2;
          while (this.tables.has(`${info.name}#${n}`)) n++;
          this.tables.set(`${info.name}#${n}`, info);
        }
        if (pending) pending.bodyEnd = stmt.start;
        pending = info;
        current = info;
        continue;
      }
      if (stmt.kind === 'kv') {
        current!.statements.push(stmt);
      }
    }
    if (pending) pending.bodyEnd = this.text.length;

    this.root = root;
    this.tables.set('', root);
  }

  private root!: TableInfo;

  // ---------------------------------------------------------------- lookup

  getTables(): TableInfo[] {
    return [...this.tables.values()].filter((t) => t.headerIndex >= 0);
  }

  getTable(name: string): TableInfo | undefined {
    return this.tables.get(normalizeTableName(name));
  }

  /** Tables that are direct or deep children of `name`. */
  getChildTables(name: string): TableInfo[] {
    const prefix = normalizeTableName(name) + '.';
    return this.getTables().filter((t) => t.name.startsWith(prefix));
  }

  getKey(tableName: string, key: string | string[]): KeyLocation | undefined {
    const table = this.getTable(tableName);
    if (!table) return undefined;
    const path = toKeyPath(key);
    let stmt = table.statements.find((s) => samePath(s.keyPath!, path));
    // A quoted key may itself contain dots (`"foo.bar"`); match its raw text
    // before treating the argument as a dotted path.
    if (!stmt && typeof key === 'string') {
      const raw = key.trim();
      stmt = table.statements.find((s) => s.keyRaw?.trim() === raw);
    }
    return stmt ? { table, statement: stmt } : undefined;
  }

  /**
   * Every key/value statement with the table path it belongs to. This sees
   * declarations written as dotted keys (including at the document root),
   * which table-based lookup cannot reach.
   */
  allKeyStatements(): { table: TableInfo; tablePath: string[]; statement: Statement }[] {
    const result: { table: TableInfo; tablePath: string[]; statement: Statement }[] = [];
    for (const table of this.tables.values()) {
      for (const stmt of table.statements) {
        result.push({ table, tablePath: table.path, statement: stmt });
      }
    }
    return result;
  }

  /** Find a key/value statement by its full decoded path. */
  findByPath(path: string[]): KeyLocation | undefined {
    for (const table of this.tables.values()) {
      for (const stmt of table.statements) {
        if (samePath([...table.path, ...(stmt.keyPath ?? [])], path)) {
          return { table, statement: stmt };
        }
      }
    }
    return undefined;
  }

  getValue(tableName: string, key: string): string | undefined {
    return this.getKey(tableName, key)?.statement.valueRaw;
  }

  /** Does this table exist, either as a header or implicitly as a dotted key? */
  hasTable(name: string): boolean {
    return this.getTable(name) !== undefined;
  }

  hasKey(tableName: string, key: string): boolean {
    return this.getKey(tableName, key) !== undefined;
  }

  // ---------------------------------------------------------------- edits

  setKey(tableName: string, key: string | string[], valueText: string, options: { anchorTables?: string[] } = {}): TextEdit[] {
    const path = toKeyPath(key);
    const table = this.getTable(tableName);
    const existing = table ? table.statements.find((s) => samePath(s.keyPath!, path)) : undefined;

    if (existing && existing.valueStart !== undefined && existing.valueEnd !== undefined) {
      return [{ start: existing.valueStart, end: existing.valueEnd, text: valueText }];
    }

    const created = this.createTable(tableName, options.anchorTables);
    let line = `${formatKeyPath(path)} = ${valueText}`;
    if (!table && created.length > 0) {
      // Table is created by an edit in the same batch; append the key to the
      // generated block so the two edits do not need to see each other.
      const withKey = created.map((edit) => ({
        ...edit,
        text: edit.text.replace(/(\[[^\]]+\]\r?\n)/, `$1${line}${this.eol}`),
      }));
      return withKey;
    }
    return [...created, this.insertInTable(table!, line)];
  }

  /**
   * Remove a key. When `dropEmptyTable` is set the table header is removed too
   * if this was its only entry.
   */
  removeKey(tableName: string, key: string | string[], options: { dropEmptyTable?: boolean } = {}): TextEdit[] {
    const table = this.getTable(tableName);
    if (!table) return [];
    const pathParts = Array.isArray(key) ? key : parseDottedKey(key);
    if (!pathParts) return [];
    const stmt = table.statements.find((s) => samePath(s.keyPath!, pathParts));
    if (!stmt) return [];

    if (options.dropEmptyTable && table.statements.length === 1) {
      const header = this.statements[table.headerIndex];
      if (header) {
        // Remove the header together with the key so comments that belonged to
        // the table do not end up attached to the previous section.
        return [{ start: lineStartOffset(this.text, header.start), end: statementLineEnd(this.text, stmt.end), text: '' }];
      }
    }
    return [{ start: lineStartOffset(this.text, stmt.start), end: statementLineEnd(this.text, stmt.end), text: '' }];
  }

  /** Replace an entire table, header included. */
  replaceTable(tableName: string, newBlock: string): TextEdit[] {
    const table = this.getTable(tableName);
    if (!table) return [];
    const header = this.statements[table.headerIndex];
    if (!header) return [];
    return [{ start: lineStartOffset(this.text, header.start), end: trimTrailingBlankLines(this.text, table.bodyEnd), text: newBlock }];
  }

  removeTable(tableName: string): TextEdit[] {
    const table = this.getTable(tableName);
    if (!table) return [];
    const header = this.statements[table.headerIndex];
    if (!header) return [];
    const start = lineStartOffset(this.text, header.start);
    let end = trimTrailingBlankLines(this.text, table.bodyEnd);
    // Also drop the blank line that separated it from the preceding block.
    return [{ start, end, text: '' }];
  }

  /** Ensure a table header exists, returning insertion edits when missing. */
  createTable(tableName: string, anchorTables: string[] = []): TextEdit[] {
    if (this.hasTable(tableName)) return [];
    const name = normalizeTableName(tableName);
    const block = `[${formatTableName(name)}]`;

    // A parent table must be declared before its children, otherwise TOML
    // rejects reopening the parent later.
    const child = this.getChildTables(name)[0];
    if (child) {
      const header = this.statements[child.headerIndex];
      return [{ start: lineStartOffset(this.text, header.start), end: lineStartOffset(this.text, header.start), text: block + this.eol + this.eol }];
    }

    for (const anchor of anchorTables) {
      const table = this.getTable(anchor);
      if (table) {
        const header = this.statements[table.headerIndex];
        return [{ start: lineStartOffset(this.text, header.start), end: lineStartOffset(this.text, header.start), text: block + this.eol + this.eol }];
      }
    }

    const insertAt = appendPoint(this.text);
    const prefix = insertAt === 0 || this.text.slice(0, insertAt).endsWith('\n\n') ? '' : this.text.slice(0, insertAt).endsWith('\n') ? this.eol : this.eol + this.eol;
    return [{ start: insertAt, end: insertAt, text: prefix + block + this.eol }];
  }

  private insertInTable(table: TableInfo, line: string): TextEdit {
    const last = table.statements[table.statements.length - 1];
    if (last) {
      const nextHeader = this.nextHeaderStart(table);
      const at = trimTrailingBlankLines(this.text, nextHeader);
      const needsNewline = !this.text.slice(0, at).endsWith('\n');
      return { start: at, end: at, text: (needsNewline ? this.eol : '') + line + this.eol };
    }

    const header = this.statements[table.headerIndex];
    if (!header) {
      throw new TomlEditError(`Cannot insert into implicit table "${table.name}"`);
    }
    const at = lineEndOffset(this.text, header.end);
    return { start: at, end: at, text: line + this.eol };
  }

  private nextHeaderStart(table: TableInfo): number {
    for (let i = table.headerIndex + 1; i < this.statements.length; i++) {
      const s = this.statements[i];
      if (s.kind === 'table' || s.kind === 'arrayTable') return s.start;
    }
    return this.text.length;
  }

  /** Apply edits, sorted so earlier offsets stay valid. */
  apply(edits: TextEdit[]): string {
    return applyEdits(this.text, edits);
  }

  // ---------------------------------------------------------------- helpers

  /** Style of array literals already present, used for new values. */
  arrayStyle(): 'spaced' | 'compact' {
    return /\w\s*=\s*\[\s+"/.test(this.text) ? 'spaced' : 'compact';
  }

  /** Detect whether the document separates tables with a single blank line. */
  get tableSpacing(): string {
    return this.eol + this.eol;
  }
}

// ------------------------------------------------------------------ utilities

export function applyEdits(text: string, edits: TextEdit[]): string {
  const sorted = [...edits]
    .filter((e) => e.start !== e.end || e.text !== '')
    .sort((a, b) => b.start - a.start || b.end - a.end);
  let result = text;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const edit of sorted) {
    if (edit.end > lastStart) {
      throw new TomlEditError('Overlapping edits');
    }
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    lastStart = edit.start;
  }
  return result;
}

export function normalizeTableName(name: string): string {
  const trimmed = name.trim().replace(/^\[+|\]+$/g, '');
  return parseDottedKey(trimmed)?.join('.') ?? trimmed;
}

function formatTableName(name: string): string {
  return parseDottedKey(name)?.map(quoteKey).join('.') ?? name;
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((part, i) => part === b[i]);
}

function toKeyPath(key: string | string[]): string[] {
  if (Array.isArray(key)) return key;
  return parseDottedKey(key) ?? [key];
}

/** Parse `a."b.c".d` into ['a', 'b.c', 'd']. Returns null on malformed input. */
export function parseDottedKey(input: string): string[] | null {
  const parts: string[] = [];
  let i = 0;
  const s = input.trim();
  if (s === '') return null;

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) return null;

    let part = '';
    if (s[i] === '"' || s[i] === "'") {
      const quote = s[i];
      i++;
      if (quote === '"') {
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\') {
            const esc = s[i + 1];
            part += unescapeBasic(esc);
            i += 2;
            continue;
          }
          part += s[i++];
        }
      } else {
        while (i < s.length && s[i] !== "'") {
          part += s[i++];
        }
      }
      if (s[i] !== quote) return null;
      i++;
    } else {
      const start = i;
      while (i < s.length && !/[\s.]/.test(s[i])) i++;
      part = s.slice(start, i);
      if (!isBareKey(part)) return null;
    }
    parts.push(part);
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i < s.length) {
      if (s[i] !== '.') return null;
      i++;
    }
  }
  return parts.length ? parts : null;
}

function unescapeBasic(esc: string): string {
  switch (esc) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    case 'r':
      return '\r';
    case 'b':
      return '\b';
    case 'f':
      return '\f';
    case '"':
      return '"';
    case '\\':
      return '\\';
    case 'u':
      return '';
    case 'U':
      return '';
    default:
      return esc;
  }
}

function findTopLevelEquals(raw: string): number {
  let mode: ScanState['mode'] = 'normal';
  let brace = 0;
  let bracket = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (mode === 'basic') {
      if (ch === '\\') i++;
      else if (ch === '"') mode = 'normal';
      continue;
    }
    if (mode === 'literal') {
      if (ch === "'") mode = 'normal';
      continue;
    }
    if (mode === 'mlBasic') {
      if (ch === '"' && raw.startsWith('"""', i)) {
        mode = 'normal';
        i += 2;
      } else if (ch === '\\') i++;
      continue;
    }
    if (mode === 'mlLiteral') {
      if (ch === "'" && raw.startsWith("'''", i)) {
        mode = 'normal';
        i += 2;
      }
      continue;
    }
    if (ch === '#') return -1;
    if (ch === '"') {
      if (raw.startsWith('"""', i)) {
        mode = 'mlBasic';
        i += 2;
      } else mode = 'basic';
      continue;
    }
    if (ch === "'") {
      if (raw.startsWith("'''", i)) {
        mode = 'mlLiteral';
        i += 2;
      } else mode = 'literal';
      continue;
    }
    if (ch === '{') brace++;
    if (ch === '}') brace = Math.max(0, brace - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);
    if (ch === '=' && brace === 0 && bracket === 0) return i;
  }
  return -1;
}

/** Offset of a trailing comment on the value, or `end` when absent. */
function findTrailingComment(text: string, valueStart: number, end: number): number {
  let mode: ScanState['mode'] = 'normal';
  let brace = 0;
  let bracket = 0;
  for (let i = valueStart; i < end; i++) {
    const ch = text[i];
    switch (mode) {
      case 'basic':
        if (ch === '\\') i++;
        else if (ch === '"') mode = 'normal';
        continue;
      case 'literal':
        if (ch === "'") mode = 'normal';
        continue;
      case 'mlBasic':
        if (ch === '"' && text.startsWith('"""', i)) {
          mode = 'normal';
          i += 2;
        } else if (ch === '\\') i++;
        continue;
      case 'mlLiteral':
        if (ch === "'" && text.startsWith("'''", i)) {
          mode = 'normal';
          i += 2;
        }
        continue;
      default:
        break;
    }
    if (ch === '#') {
      if (brace === 0 && bracket === 0) return i;
      // Comments are allowed inside multiline arrays/tables; skip the rest of
      // the line so a quote or bracket in the comment cannot corrupt the scan.
      const newline = text.indexOf('\n', i);
      if (newline < 0) return end;
      i = newline;
      continue;
    }
    if (ch === '"') {
      if (text.startsWith('"""', i)) {
        mode = 'mlBasic';
        i += 2;
      } else mode = 'basic';
      continue;
    }
    if (ch === "'") {
      if (text.startsWith("'''", i)) {
        mode = 'mlLiteral';
        i += 2;
      } else mode = 'literal';
      continue;
    }
    if (ch === '{') brace++;
    if (ch === '}') brace = Math.max(0, brace - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);
  }
  return end;
}

function lineStartOffset(text: string, offset: number): number {
  const idx = text.lastIndexOf('\n', offset - 1);
  return idx < 0 ? 0 : idx + 1;
}

function lineEndOffset(text: string, offset: number): number {
  const idx = text.indexOf('\n', offset);
  return idx < 0 ? text.length : idx + 1;
}

function statementLineEnd(text: string, end: number): number {
  const idx = text.indexOf('\n', end);
  return idx < 0 ? text.length : idx + 1;
}

function trimTrailingBlankLines(text: string, end: number): number {
  let result = end;
  while (result > 0) {
    const lineStart = lineStartOffset(text, result - 1);
    const line = text.slice(lineStart, result).trim();
    if (line !== '') break;
    result = lineStart;
  }
  return result;
}

function appendPoint(text: string): number {
  if (text.length === 0) return 0;
  return text.endsWith('\n') ? text.length : text.length;
}
