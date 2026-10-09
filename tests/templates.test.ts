import { describe, expect, it } from "vitest";
import { TEMPLATE_BY_ID } from "../src/shared/templates";

describe("secret templates", () => {
  it("provides an object storage credential template", () => {
    const template = TEMPLATE_BY_ID.get("object-storage");
    expect(template?.name).toBe("对象存储");
    expect(template?.fields.map((field) => field.id)).toEqual([
      "endpoint",
      "bucket",
      "region",
      "accessKeyId",
      "secretAccessKey",
      "sessionToken",
      "pathStyle",
    ]);
  });
});
