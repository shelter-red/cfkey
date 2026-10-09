import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, searchable, tagsFrom } from "../src/worker/utils";

describe("query helpers", () => {
  it("normalizes searchable metadata", () => {
    expect(searchable("  GitHub ")).toBe("  github ");
  });

  it("deduplicates and bounds tags", () => {
    expect(tagsFrom([" prod ", "PROD", "数据库", ""])).toEqual(["prod", "数据库"]);
    expect(tagsFrom(Array.from({ length: 20 }, (_, index) => `t${index}`))).toHaveLength(12);
  });

  it("round trips opaque cursors", () => {
    const cursor = { updatedAt: 123, id: "item" };
    expect(decodeCursor<typeof cursor>(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor("invalid")).toBeNull();
  });
});
