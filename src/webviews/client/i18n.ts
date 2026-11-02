/**
 * Webview-side translation. The extension host injects a dictionary; missing
 * keys fall back to the English source string so panels never show blanks.
 */
let dictionary: Record<string, string> = {};

export function registerI18n(values: Record<string, string>): void {
  dictionary = values ?? {};
}

export function t(message: string, ...args: (string | number)[]): string {
  const template = dictionary[message] ?? message;
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

export function hasTranslation(message: string): boolean {
  return message in dictionary;
}
