import { describe, expect, it, mock } from "bun:test";

import { getMigrationFiles, runMigrations } from "./runner";

const sqlDir = `${import.meta.dir}/../sql`;

describe("getMigrationFiles", () => {
  it("returns only .up.sql files for up direction", () => {
    const files = getMigrationFiles(sqlDir, "up");
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.name).toEndWith(".up.sql");
    }
  });

  it("returns only .down.sql files for down direction", () => {
    const files = getMigrationFiles(sqlDir, "down");
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.name).toEndWith(".down.sql");
    }
  });

  it("sorts up files ascending by number", () => {
    const files = getMigrationFiles(sqlDir, "up");
    const numbers = files.map((f) => f.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("sorts down files descending by number", () => {
    const files = getMigrationFiles(sqlDir, "down");
    const numbers = files.map((f) => f.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  });

  it("parses the numeric prefix correctly", () => {
    const files = getMigrationFiles(sqlDir, "up");
    for (const f of files) {
      expect(f.number).toBeGreaterThan(0);
      expect(f.name.startsWith(String(f.number).padStart(3, "0"))).toBeTrue();
    }
  });

  it("includes the absolute path", () => {
    const files = getMigrationFiles(sqlDir, "up");
    for (const f of files) {
      expect(f.path).toStartWith(sqlDir);
      expect(f.path).toEndWith(f.name);
    }
  });
});

describe("runMigrations", () => {
  it("executes each up file via the provided function in ascending order", async () => {
    const calls: string[] = [];
    const exec = mock(async (text: string) => {
      calls.push(text);
    });

    const result = await runMigrations(sqlDir, "up", exec);

    expect(result.total).toBe(6);
    expect(exec).toHaveBeenCalledTimes(6);
    expect(calls[0]).toInclude("CREATE TABLE players");
    expect(calls[calls.length - 1]).toInclude("CREATE TABLE friends");
  });

  it("executes each down file in descending order", async () => {
    const calls: string[] = [];
    const exec = mock(async (text: string) => {
      calls.push(text);
    });

    const result = await runMigrations(sqlDir, "down", exec);

    expect(result.total).toBe(6);
    expect(exec).toHaveBeenCalledTimes(6);
    // Down should start with 006_friends, end with 001_players
    expect(calls[0]).toInclude("DROP TABLE IF EXISTS friends");
    expect(calls[calls.length - 1]).toInclude("DROP TABLE IF EXISTS players");
  });

  it("propagates errors from the exec function", async () => {
    const exec = mock(async () => {
      throw new Error("db error");
    });

    expect(runMigrations(sqlDir, "up", exec)).rejects.toThrow("db error");
  });
});
