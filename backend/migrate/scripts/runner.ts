import { Glob } from "bun";

export interface MigrationFile {
  name: string;
  path: string;
  number: number;
}

export function getMigrationFiles(dir: string, direction: "up" | "down"): MigrationFile[] {
  return [...new Glob("*.sql").scanSync({ cwd: dir })]
    .filter((f) => f.endsWith(`.${direction}.sql`))
    .sort((a, b) => {
      const na = Number(a.split("_")[0]);
      const nb = Number(b.split("_")[0]);
      return direction === "up" ? na - nb : nb - na;
    })
    .map((name) => ({
      name,
      path: `${dir}/${name}`,
      number: Number(name.split("_")[0]),
    }));
}

export async function runMigrations(
  dir: string,
  direction: "up" | "down",
  exec: (text: string) => Promise<unknown>,
): Promise<{ total: number }> {
  const files = getMigrationFiles(dir, direction);

  for (const file of files) {
    const text = await Bun.file(file.path).text();
    await exec(text);
  }

  return { total: files.length };
}
