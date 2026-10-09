import { describe, expect, it } from "vitest";
import { buildDatabaseConnectionString, parseDatabaseConnectionString } from "../src/ui/database-connection";

describe("database connection strings", () => {
  it("builds a URL from database form fields", () => {
    expect(buildDatabaseConnectionString({
      engine: "postgresql",
      host: "db.example.com",
      port: "5432",
      database: "vault data",
      username: "admin",
      password: "p@ss/word",
    })).toBe("postgresql://admin:p%40ss%2Fword@db.example.com:5432/vault%20data");
  });

  it("parses a URL into database form fields", () => {
    expect(parseDatabaseConnectionString("mysql://root:p%40ss@db.example.com:3306/app"))
      .toEqual({ engine: "mysql", host: "db.example.com", port: "3306", database: "app", username: "root", password: "p@ss" });
  });

  it("parses a semicolon connection string into database form fields", () => {
    expect(parseDatabaseConnectionString("Server=db.internal;Port=1433;Database=main;User ID=admin;Password=secret"))
      .toMatchObject({ host: "db.internal", port: "1433", database: "main", username: "admin", password: "secret" });
  });
});
