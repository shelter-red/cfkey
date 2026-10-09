import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const forbiddenVectorMarkup = /<\s*(?:svg|path|circle|rect)\b|createElementNS|data:image\/svg/i;
const lucideKeyPath = "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z";

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".vue", ".css"].includes(extname(path)) ? [path] : [];
  });
}

describe("icon provenance", () => {
  it("keeps hand-authored vector markup out of application source", () => {
    for (const path of [...sourceFiles("src"), "index.html"]) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(forbiddenVectorMarkup);
    }
  });

  it("uses the official Lucide KeyRound geometry for the favicon", () => {
    const favicon = readFileSync("public/favicon.svg", "utf8");
    const lucideSource = readFileSync("node_modules/@lucide/vue/dist/esm/icons/key-round.mjs", "utf8");
    expect(lucideSource).toContain(lucideKeyPath);
    expect(favicon).toContain(lucideKeyPath);
    expect(favicon).toContain('cx="16.5" cy="7.5" r=".5"');
    expect(favicon).not.toMatch(/linearGradient|<rect\b/i);
  });
});
