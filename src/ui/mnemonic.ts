export const MNEMONIC_LENGTHS = [12, 15, 18, 21, 24] as const;
export const MNEMONIC_MIN_CELLS = 12;
export const MNEMONIC_MAX_CELLS = 24;

const NUMBER_PREFIX = /^\d{1,3}\s*[.、,:：)\]．]+/;
const FULL_WIDTH_SPACE = /[\u3000\u00a0]/g;

/**
 * Split raw text into mnemonic words: NFKC normalise, strip list numbering
 * (`1.`, `2、`, `3:`), collapse whitespace and drop empty tokens. Case is kept
 * because a non-BIP39 recovery phrase may be case sensitive.
 */
export function mnemonicWords(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    .normalize("NFKC")
    .replace(FULL_WIDTH_SPACE, " ")
    .split(/\s+/)
    .map((token) => token.replace(NUMBER_PREFIX, "").trim())
    .filter((token) => token.length > 0 && !/^\d+$/.test(token));
}

export function normalizeMnemonic(value: unknown): string {
  return mnemonicWords(value).join(" ");
}

export function mnemonicIssues(words: string[]): string[] {
  const issues: string[] = [];
  if (words.length === 0) return issues;
  if (!(MNEMONIC_LENGTHS as readonly number[]).includes(words.length)) {
    issues.push(`当前 ${words.length} 个单词，常见助记词长度为 12 / 15 / 18 / 21 / 24`);
  }
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) {
      if (!duplicates.includes(word)) duplicates.push(word);
    } else {
      seen.add(key);
    }
  }
  if (duplicates.length > 0) issues.push(`存在重复单词：${duplicates.join("、")}`);
  return issues;
}

/** Cell count for the numbered word grid: at least 12, always leaving room to grow. */
export function mnemonicCellCount(wordCount: number): number {
  if (wordCount < MNEMONIC_MIN_CELLS) return MNEMONIC_MIN_CELLS;
  if (wordCount >= MNEMONIC_MAX_CELLS) return wordCount;
  return wordCount + 1;
}
