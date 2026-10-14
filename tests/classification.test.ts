import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_FILTER_OPTIONS,
  CLASSIFICATION_LEAVES,
  CLASSIFICATION_LEAF_BY_ID,
  categoryPath,
  classificationLeafForType,
  createClassificationOptions,
  databaseCategoryForEngine,
  databaseEngineForCategory,
  defaultCategoryForType,
  fieldDefaultsForCategory,
  providerOptionsForCategory,
  resolveStoredCategory,
} from "../src/shared/classification";
import { DATABASE_ENGINE_OPTIONS } from "../src/shared/select-options";
import { TEMPLATE_BY_ID } from "../src/shared/templates";

const defaultProviderValues = ["自建", "通用", "其他"];

describe("classification tree", () => {
  it("uses unique ids and maps every leaf to a real template", () => {
    const ids = CLASSIFICATION_LEAVES.map((leaf) => leaf.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const leaf of CLASSIFICATION_LEAVES) {
      expect(TEMPLATE_BY_ID.has(leaf.templateId), leaf.id).toBe(true);
      expect(leaf.label.trim(), leaf.id).not.toBe("");
    }
    for (const templateId of TEMPLATE_BY_ID.keys()) {
      expect(classificationLeafForType(templateId)?.templateId, templateId).toBe(templateId);
    }
    expect(CLASSIFICATION_FILTER_OPTIONS).toHaveLength(CLASSIFICATION_LEAVES.length);
  });

  it("keeps provider suggestions leaf-specific and always permits local/custom values", () => {
    for (const leaf of CLASSIFICATION_LEAVES) {
      const values = leaf.providers.map((provider) => provider.value);
      expect(new Set(values).size, leaf.id).toBe(values.length);
      for (const provider of defaultProviderValues) {
        expect(values, leaf.id).toContain(provider);
      }
    }
    expect(providerOptionsForCategory("database.postgresql").map((item) => item.value)).not.toContain("Vercel");
    expect(providerOptionsForCategory("database.mongodb").map((item) => item.value)).not.toContain("Supabase");
    expect(providerOptionsForCategory("cloud.ssh").map((item) => item.value)).not.toContain("Stripe");
    expect(providerOptionsForCategory("server.ftp").map((item) => item.value)).not.toContain("Vercel");
    expect(providerOptionsForCategory("devops.registry").map((item) => item.value)).not.toContain("SendGrid");
  });

  it("derives file-transfer and mail protocols from the selected leaf", () => {
    expect(fieldDefaultsForCategory("server.ftp")).toEqual({ protocol: "FTP" });
    expect(fieldDefaultsForCategory("server.ftps")).toEqual({ protocol: "FTPS" });
    expect(fieldDefaultsForCategory("server.sftp")).toEqual({ protocol: "SFTP" });
    expect(fieldDefaultsForCategory("mail.smtp")).toEqual({ protocol: "SMTP" });
    expect(fieldDefaultsForCategory("mail.imap")).toEqual({ protocol: "IMAP" });
    expect(fieldDefaultsForCategory("mail.pop3")).toEqual({ protocol: "POP3" });
    expect(fieldDefaultsForCategory("other.generic")).toEqual({});
  });

  it("derives database engines from database leaves only", () => {
    const engineValues = new Set(DATABASE_ENGINE_OPTIONS.map((option) => option.value));
    for (const leaf of CLASSIFICATION_LEAVES.filter((item) => item.templateId === "database" && item.id !== "database.legacy")) {
      expect(leaf.databaseEngine, leaf.id).toBeTruthy();
      expect(engineValues.has(leaf.databaseEngine!), leaf.id).toBe(true);
      expect(databaseEngineForCategory(leaf.id), leaf.id).toBe(leaf.databaseEngine);
    }
    expect(databaseEngineForCategory("database.legacy")).toBeUndefined();
    expect(databaseEngineForCategory("other.generic")).toBeUndefined();
  });

  it("resolves legacy and blank categories without changing the template", () => {
    expect(resolveStoredCategory("", "api-key")).toBe("development.api-key");
    expect(resolveStoredCategory("云服务", "ssh")).toBe("cloud.ssh");
    expect(resolveStoredCategory("第三方", "generic")).toBe("other.generic");
    expect(resolveStoredCategory("database.redis", "database")).toBe("database.redis");
    expect(resolveStoredCategory("", "database")).toBe("database.legacy");
    expect(defaultCategoryForType("unknown")).toBe("other.generic");
  });

  it("builds readable paths and template-scoped editor options", () => {
    expect(categoryPath("cloud.ssh", "ssh")).toBe("服务器与网络 / SSH 主机");
    expect(categoryPath("", "api-key")).toBe("开发运维 / API 密钥");
    expect(categoryPath("server.webdav", "webdav")).toBe("服务器与网络 / WebDAV");
    const options = createClassificationOptions("database");
    expect(options).toHaveLength(1);
    expect(options[0].children?.length).toBeGreaterThan(10);
    expect(options[0].children?.every((option) => CLASSIFICATION_LEAF_BY_ID.get(option.value)?.templateId === "database")).toBe(true);
    expect(options[0].children?.map((option) => option.value)).not.toContain("database.legacy");
    const legacyOptions = createClassificationOptions("database", true);
    expect(legacyOptions[0].children?.map((option) => option.value)).toContain("database.legacy");
    const allOptions = createClassificationOptions();
    expect(allOptions.map((option) => option.label)).toEqual(expect.arrayContaining([
      "服务器与网络",
      "邮件与消息",
      "域名与网络",
      "监控告警",
    ]));
  });

  it("maps pasted connection-string engines back to a database leaf", () => {
    expect(databaseCategoryForEngine("postgres")).toBe("database.postgresql");
    expect(databaseCategoryForEngine("mssql")).toBe("database.sqlserver");
    expect(databaseCategoryForEngine("mongodb")).toBe("database.mongodb");
    expect(databaseCategoryForEngine("custom-engine")).toBeUndefined();
  });
});
