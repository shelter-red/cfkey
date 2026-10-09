import { describe, expect, it } from "vitest";
import { findDatabaseId, renderImportConfig } from "../scripts/deploy-import.mjs";

const databaseId = "123e4567-e89b-42d3-a456-426614174000";

describe("import deployment", () => {
  it("finds an existing D1 database by its exact name", () => {
    expect(findDatabaseId([{ name: "other", uuid: databaseId }, { name: "cfkey-db", uuid: databaseId }])).toBe(databaseId);
    expect(findDatabaseId([{ name: "other", uuid: databaseId }])).toBeNull();
  });

  it("updates the permanent import configuration without changing other bindings", () => {
    const source = JSON.stringify({
      name: "cfkey",
      d1_databases: [{ binding: "DB", database_name: "cfkey-db", database_id: "00000000-0000-0000-0000-000000000000" }],
      assets: { binding: "ASSETS" },
    }, null, 2);
    const config = JSON.parse(renderImportConfig(source, databaseId));
    expect(config.d1_databases[0].database_id).toBe(databaseId);
    expect(config.assets.binding).toBe("ASSETS");
  });
});
