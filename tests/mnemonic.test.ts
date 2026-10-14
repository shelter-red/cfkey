import { describe, expect, it } from "vitest";
import { mnemonicCellCount, mnemonicIssues, mnemonicWords, normalizeMnemonic } from "../src/ui/mnemonic";

describe("mnemonic parsing", () => {
  it("strips list numbering and separators", () => {
    expect(mnemonicWords("1. apple 2、banana 3: cherry 4) date")).toEqual(["apple", "banana", "cherry", "date"]);
  });

  it("normalises full-width spaces and characters", () => {
    expect(mnemonicWords("ＡＢＣ\u3000banana\u00a0cherry")).toEqual(["ABC", "banana", "cherry"]);
  });

  it("keeps case but drops empty and bare-number tokens", () => {
    expect(mnemonicWords("  12   Abandon   24  ")).toEqual(["Abandon"]);
    expect(mnemonicWords("")).toEqual([]);
    expect(mnemonicWords(null)).toEqual([]);
  });

  it("round-trips through a single-space form", () => {
    expect(normalizeMnemonic("1. one\n2. two")).toBe("one two");
  });
});

describe("mnemonic validation", () => {
  const words = (count: number) => Array.from({ length: count }, (_, index) => `word${index}`);

  it("accepts the standard phrase lengths without warnings", () => {
    for (const length of [12, 15, 18, 21, 24]) {
      expect(mnemonicIssues(words(length))).toEqual([]);
    }
  });

  it("warns but does not fail on unusual lengths", () => {
    const issues = mnemonicIssues(words(13));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("13");
  });

  it("flags duplicate words case-insensitively", () => {
    const issues = mnemonicIssues(["Abandon", ...words(11), "abandon"]);
    expect(issues.some((issue) => issue.includes("重复"))).toBe(true);
  });

  it("reports nothing for an empty phrase", () => {
    expect(mnemonicIssues([])).toEqual([]);
  });
});

describe("mnemonic grid sizing", () => {
  it("keeps at least twelve cells and always offers one more", () => {
    expect(mnemonicCellCount(0)).toBe(12);
    expect(mnemonicCellCount(12)).toBe(13);
    expect(mnemonicCellCount(24)).toBe(24);
    expect(mnemonicCellCount(30)).toBe(30);
  });
});
