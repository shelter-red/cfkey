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

  it("provides field-differentiated server, mail and registry templates", () => {
    expect(TEMPLATE_BY_ID.get("ftp")?.fields.map((field) => field.id)).toEqual([
      "protocol",
      "host",
      "port",
      "username",
      "password",
      "remotePath",
      "mode",
    ]);
    expect(TEMPLATE_BY_ID.get("ftp")?.fields.find((field) => field.id === "protocol")?.hidden).toBe(true);
    expect(TEMPLATE_BY_ID.get("webdav")?.fields.map((field) => field.id)).toEqual([
      "url",
      "username",
      "password",
      "remotePath",
    ]);
    expect(TEMPLATE_BY_ID.get("vpn")?.fields.map((field) => field.id)).toEqual([
      "protocol",
      "server",
      "port",
      "username",
      "password",
      "preSharedKey",
      "privateKey",
      "config",
    ]);
    expect(TEMPLATE_BY_ID.get("remote-desktop")?.fields.map((field) => field.id)).toEqual([
      "protocol",
      "host",
      "port",
      "username",
      "password",
      "domain",
      "gateway",
    ]);
    expect(TEMPLATE_BY_ID.get("proxy")?.fields.map((field) => field.id)).toEqual([
      "protocol",
      "host",
      "port",
      "username",
      "password",
      "url",
    ]);
    expect(TEMPLATE_BY_ID.get("mail")?.fields.map((field) => field.id)).toEqual([
      "protocol",
      "host",
      "port",
      "encryption",
      "username",
      "password",
      "fromAddress",
    ]);
    expect(TEMPLATE_BY_ID.get("mail")?.fields.find((field) => field.id === "protocol")?.hidden).toBe(true);
    expect(TEMPLATE_BY_ID.get("registry")?.fields.map((field) => field.id)).toEqual([
      "endpoint",
      "namespace",
      "username",
      "password",
    ]);
  });
});
