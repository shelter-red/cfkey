import { describe, expect, it } from "vitest";
import {
  CATEGORY_OPTIONS, DATABASE_ENGINE_OPTIONS, PATH_STYLE_OPTIONS, PROVIDER_OPTIONS,
  REGION_OPTIONS, WALLET_NETWORK_OPTIONS, WEBHOOK_HEADER_OPTIONS,
} from "../src/shared/select-options";
import { SECRET_TEMPLATES, TEMPLATE_BY_ID } from "../src/shared/templates";
import type { SecretFieldOption } from "../src/shared/types";
import { buildDatabaseConnectionString } from "../src/ui/database-connection";

const catalogs: Record<string, SecretFieldOption[]> = {
  DATABASE_ENGINE_OPTIONS, PATH_STYLE_OPTIONS, WEBHOOK_HEADER_OPTIONS,
  REGION_OPTIONS, WALLET_NETWORK_OPTIONS, PROVIDER_OPTIONS, CATEGORY_OPTIONS,
};

describe("select option catalogs", () => {
  it("are non-empty with unique values", () => {
    for (const [name, options] of Object.entries(catalogs)) {
      expect(options.length, name).toBeGreaterThan(0);
      const values = options.map((option) => option.value);
      expect(new Set(values).size, name).toBe(values.length);
      for (const option of options) {
        expect(option.label.trim().length, `${name}:${option.value}`).toBeGreaterThan(0);
        expect(option.value.trim(), name).toBe(option.value);
        expect(option.value.length, name).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every database engine usable as a connection-string scheme", () => {
    for (const option of DATABASE_ENGINE_OPTIONS) {
      const connection = buildDatabaseConnectionString({ engine: option.value, host: "db.example.com" });
      expect(connection.startsWith(`${option.value}://`), `${option.label} -> ${connection}`).toBe(true);
    }
  });
});

describe("template select fields", () => {
  it("only references shared catalogs", () => {
    const shared = new Set(Object.values(catalogs));
    for (const template of SECRET_TEMPLATES) {
      for (const field of template.fields) {
        if (!field.options) continue;
        expect(shared.has(field.options), `${template.id}.${field.id}`).toBe(true);
      }
    }
  });

  it("covers every field with a limited value set", () => {
    const optionsFor = (templateId: string, fieldId: string) =>
      TEMPLATE_BY_ID.get(templateId)?.fields.find((field) => field.id === fieldId)?.options;
    expect(optionsFor("database", "engine")).toBe(DATABASE_ENGINE_OPTIONS);
    expect(optionsFor("object-storage", "pathStyle")).toBe(PATH_STYLE_OPTIONS);
    expect(optionsFor("object-storage", "region")).toBe(REGION_OPTIONS);
    expect(optionsFor("cloud", "region")).toBe(REGION_OPTIONS);
    expect(optionsFor("webhook", "headerName")).toBe(WEBHOOK_HEADER_OPTIONS);
    expect(optionsFor("recovery-phrase", "network")).toBe(WALLET_NETWORK_OPTIONS);
  });
});
