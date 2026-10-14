import { describe, expect, it } from "vitest";
import { planTemplateTransition } from "../src/shared/field-transition";

describe("template field transitions", () => {
  it("keeps same-name fields and reports discarded fields", () => {
    const transition = planTemplateTransition({
      identifier: "server-1",
      secret: "old-secret",
      host: "old.example.com",
      username: "deploy",
      unknown: "legacy",
    }, "generic", "ftp");

    expect(transition.fields).toEqual({ host: "old.example.com", username: "deploy" });
    expect(transition.preserved).toEqual(["主机", "用户名"]);
    expect(transition.dropped).toEqual(["标识", "密钥值", "unknown"]);
  });

  it("keeps all compatible values and handles an empty source", () => {
    const transition = planTemplateTransition({}, "ssh", "login");
    expect(transition.fields).toEqual({});
    expect(transition.preserved).toEqual([]);
    expect(transition.dropped).toEqual([]);
  });
});
