/**
 * File-tree helpers shared by the Files view.
 *
 * Kept free of `vscode` imports so the ordering and exclude rules stay
 * testable under plain Node.
 */

export interface SortableEntry {
  name: string;
  isDirectory: boolean;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const globCache = new Map<string, RegExp>();

/** VS Code's explorer sorts folders first by default, with natural number order. */
export function sortEntries<T extends SortableEntry>(entries: readonly T[], sortOrder = 'default'): T[] {
  const group = (entry: T): number => {
    if (sortOrder === 'mixed') return 0;
    if (sortOrder === 'filesFirst') return entry.isDirectory ? 1 : 0;
    return entry.isDirectory ? 0 : 1;
  };
  return [...entries].sort((left, right) => {
    const grouped = group(left) - group(right);
    if (grouped !== 0) return grouped;
    return collator.compare(left.name, right.name) || left.name.localeCompare(right.name);
  });
}

/** Expand simple `{a,b}` alternations used by some exclude patterns. */
function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf('{');
  if (open === -1) return [pattern];
  const close = pattern.indexOf('}', open + 1);
  if (close === -1) return [pattern];
  const choices = pattern.slice(open + 1, close).split(',');
  if (choices.length < 2) return [pattern];
  const prefix = pattern.slice(0, open);
  const suffix = pattern.slice(close + 1);
  return choices.flatMap((choice) => expandBraces(prefix + choice + suffix));
}

/** Compile a VS Code-style glob into an anchored regular expression. */
export function compileGlob(glob: string): RegExp {
  const cached = globCache.get(glob);
  if (cached) return cached;

  const pattern = glob.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  let source = '^';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        index++;
        if (pattern[index + 1] === '/') {
          index++;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  source += '$';

  const regex = new RegExp(source);
  globCache.set(glob, regex);
  return regex;
}

/**
 * True when `relativePath` (relative to the project root, `/` separated) is
 * hidden by one of the `files.exclude` patterns. Directory matches also test
 * a trailing slash so `**\/node_modules/**` hides the folder itself.
 */
export function isPathExcluded(relativePath: string, patterns: readonly string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  if (!normalized) return false;
  const withSlash = `${normalized}/`;
  return patterns.some((pattern) =>
    expandBraces(pattern).some((expanded) => {
      const regex = compileGlob(expanded);
      return regex.test(normalized) || regex.test(withSlash);
    }),
  );
}
