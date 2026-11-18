// Picks the next @bulla/registry version by comparing what the package ships with the last release (the highest
// v* tag), and sets it in package.json. Run by the Consolidate Registry workflow after consolidation.
//
// The rules (also in the README):
//   major: a removed or renamed field (registry.schema.json), or a removed network, contract, pool, client, ABI,
//          ABI function/event/error
//   minor: a new field, network, contract, pool, client, ABI, or ABI function/event/error
//   patch: any other change, e.g. a changed address or endpoint
// A rename shows as a removal plus an addition, so it is major. generatedAt is ignored.
//
// Writes release=true|false and version=<x.y.z> to $GITHUB_OUTPUT, and the release notes to the file passed as
// --notes <path>. A version set by hand in package.json above the computed one wins, which also releases.
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export type Bump = "major" | "minor" | "patch";
export interface Change {
  bump: Bump;
  what: string;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

const RANK: Record<Bump, number> = { patch: 0, minor: 1, major: 2 };

/** The largest bump among the changes, or null if there are none. */
export function bumpOf(changes: Change[]): Bump | null {
  return changes.reduce<Bump | null>((max, c) => (max === null || RANK[c.bump] > RANK[max] ? c.bump : max), null);
}

// ---------------------------------------------------------------------------------------------------------------
// Versions

export function parseVersion(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`Not a release version: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export function incVersion(v: string, bump: Bump): string {
  const [major, minor, patch] = parseVersion(v);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// ---------------------------------------------------------------------------------------------------------------
// registry.json

// Maps whose entries are things consumers look up (a network, a contract, a client): a new entry is minor, a
// removed one major. Everything else is a record whose fields the schema defines, so a value appearing or
// disappearing there is a data change (patch); new or removed fields are caught by the schema diff.
const COLLECTIONS = [/^networks$/, /^networks\.[^.]+\.contracts$/, /^networks\.[^.]+\.contracts\.[^.]+$/, /^clients$/];

// pools is an array; a pool is identified by its chain and address (unique, checked in validate-registry.ts).
const poolId = (p: Json): string => {
  const pool = p as JsonObject;
  return `${pool.chainId}:${String(pool.address).toLowerCase()}`;
};

const describe = (path: string) => path || "(root)";

export function diffRegistry(before: unknown, after: unknown): Change[] {
  const changes: Change[] = [];

  const walk = (a: Json | undefined, b: Json | undefined, path: string): void => {
    if (path === "generatedAt") return;
    if (path === "pools" && Array.isArray(a) && Array.isArray(b)) {
      const byId = (pools: Json[]) => Object.fromEntries(pools.map((p) => [poolId(p), p]));
      return entries(byId(a), byId(b), path, true);
    }
    if (isObject(a) && isObject(b)) return entries(a, b, path, COLLECTIONS.some((c) => c.test(path)));
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ bump: "patch", what: `changed ${describe(path)}` });
  };

  const entries = (a: JsonObject, b: JsonObject, path: string, collection: boolean): void => {
    for (const key of Object.keys(a)) {
      const p = path ? `${path}.${key}` : key;
      if (!(key in b)) changes.push({ bump: collection ? "major" : "patch", what: `removed ${p}` });
      else walk(a[key], b[key], p);
    }
    for (const key of Object.keys(b)) {
      const p = path ? `${path}.${key}` : key;
      if (!(key in a)) changes.push({ bump: collection ? "minor" : "patch", what: `added ${p}` });
    }
  };

  walk(before as Json, after as Json, "");
  return changes;
}

// ---------------------------------------------------------------------------------------------------------------
// registry.schema.json

/**
 * Fields are the keys of each "properties": a new one is minor, a removed one major. A field that is no longer
 * required becomes optional in the generated types, which breaks consumers, so that is major too. A removed enum
 * value is major, a new one minor. Any other change to the schema is a patch.
 */
export function diffSchema(before: unknown, after: unknown): Change[] {
  const changes: Change[] = [];

  const walk = (a: Json | undefined, b: Json | undefined, path: string): void => {
    const key = path.split(".").pop();
    if ((key === "required" || key === "enum") && Array.isArray(a) && Array.isArray(b)) {
      const [as, bs] = [a.map((v) => JSON.stringify(v)), b.map((v) => JSON.stringify(v))];
      for (const v of as.filter((v) => !bs.includes(v)))
        changes.push({ bump: "major", what: `schema: ${key === "required" ? "no longer requires" : "removed enum value"} ${v} at ${path}` });
      for (const v of bs.filter((v) => !as.includes(v)))
        changes.push({ bump: key === "required" ? "patch" : "minor", what: `schema: ${key === "required" ? "now requires" : "added enum value"} ${v} at ${path}` });
      return;
    }
    if (isObject(a) && isObject(b)) {
      const fields = key === "properties";
      for (const k of Object.keys(a)) {
        if (!(k in b)) changes.push({ bump: fields ? "major" : "patch", what: `schema: removed ${fields ? "field " : ""}${path}.${k}` });
        else walk(a[k], b[k], `${path}.${k}`);
      }
      for (const k of Object.keys(b))
        if (!(k in a)) changes.push({ bump: fields ? "minor" : "patch", what: `schema: added ${fields ? "field " : ""}${path}.${k}` });
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ bump: "patch", what: `schema: changed ${path}` });
  };

  walk(before as Json, after as Json, "$");
  return changes;
}

// ---------------------------------------------------------------------------------------------------------------
// ABIs

const abiOf = (artifact: unknown): Json[] => (Array.isArray(artifact) ? artifact : ((artifact as JsonObject)?.abi as Json[]) ?? []);

// A function, event or error by its name and input types; the constructor, fallback and receive by their type.
const fragmentId = (f: Json): string => {
  const fragment = f as JsonObject;
  const inputs = ((fragment.inputs as JsonObject[]) ?? []).map(typeOf).join(",");
  return fragment.name ? `${fragment.type} ${fragment.name}(${inputs})` : String(fragment.type);
};
const typeOf = (param: JsonObject): string =>
  String(param.type).startsWith("tuple")
    ? `(${((param.components as JsonObject[]) ?? []).map(typeOf).join(",")})${String(param.type).slice(5)}`
    : String(param.type);

export function diffAbi(file: string, before: unknown, after: unknown): Change[] {
  const [a, b] = [abiOf(before).map(fragmentId), abiOf(after).map(fragmentId)];
  const changes: Change[] = [
    ...a.filter((f) => !b.includes(f)).map((f): Change => ({ bump: "major", what: `${file}: removed ${f}` })),
    ...b.filter((f) => !a.includes(f)).map((f): Change => ({ bump: "minor", what: `${file}: added ${f}` })),
  ];
  // Bytecode, output types, parameter names and the like.
  if (changes.length === 0 && JSON.stringify(before) !== JSON.stringify(after))
    changes.push({ bump: "patch", what: `${file}: changed` });
  return changes;
}

// ---------------------------------------------------------------------------------------------------------------
// The package's files

/** The files the package ships that changes are measured on (not dist/, which is built from registry.json and the schema). */
export const isPackageFile = (path: string): boolean =>
  path === "registry.json" || path === "registry.schema.json" || /^[^/]+\/abis\/[^/]+\.json$/.test(path);

/** Compares two snapshots of the package's files, keyed by path. */
export function diffPackage(before: Map<string, Buffer>, after: Map<string, Buffer>): Change[] {
  const changes: Change[] = [];
  const json = (buf: Buffer) => JSON.parse(buf.toString("utf-8")) as Json;

  for (const [path, a] of before) {
    const b = after.get(path);
    const kind = path.includes("/abis/") ? "ABI" : "file";
    if (!b) changes.push({ bump: "major", what: `removed ${kind} ${path}` });
    else if (a.equals(b)) continue;
    else if (path === "registry.json") changes.push(...diffRegistry(json(a), json(b)));
    else if (path === "registry.schema.json") changes.push(...diffSchema(json(a), json(b)));
    else if (kind === "ABI") changes.push(...diffAbi(path, json(a), json(b)));
    else changes.push({ bump: "patch", what: `changed ${kind} ${path}` });
  }
  for (const path of after.keys()) {
    if (before.has(path)) continue;
    const kind = path.includes("/abis/") ? "ABI" : "file";
    changes.push({ bump: "minor", what: `added ${kind} ${path}` });
  }
  return changes;
}

// ---------------------------------------------------------------------------------------------------------------
// git and the working tree

const git = (args: string[], root: string): Buffer => execFileSync("git", args, { cwd: root, maxBuffer: 256 << 20 });

/** The highest vX.Y.Z tag, or null before the first release. */
export function lastReleaseTag(root: string = ROOT): string | null {
  const tags = git(["tag", "--list", "v*"], root).toString().split("\n").filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
  tags.sort((x, y) => compareVersions(x.slice(1), y.slice(1)));
  return tags.at(-1) ?? null;
}

export function filesAtTag(tag: string, root: string = ROOT): Map<string, Buffer> {
  const paths = git(["ls-tree", "-r", "--name-only", tag], root).toString().split("\n").filter(isPackageFile);
  return new Map(paths.map((p) => [p, git(["show", `${tag}:${p}`], root)]));
}

/** The package's files as they are on disk, new untracked ones (e.g. a new ABI) included. */
export function filesOnDisk(root: string = ROOT): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const top of readdirSync(root)) {
    const full = join(root, top);
    if (top === "node_modules" || top.startsWith(".")) continue;
    if (!statSync(full).isDirectory()) {
      if (isPackageFile(top)) files.set(top, readFileSync(full));
      continue;
    }
    const dir = join(full, "abis");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = `${top}/abis/${name}`;
      if (isPackageFile(path)) files.set(path, readFileSync(join(dir, name)));
    }
  }
  return files;
}

export interface Plan {
  release: boolean;
  version: string;
  notes: string;
}

/**
 * What to release, from the last release tag (null before the first), the version in package.json, and the
 * changes since that tag.
 */
export function plan(tag: string | null, packageVersion: string, changes: Change[]): Plan {
  if (tag === null) return { release: true, version: packageVersion, notes: "First release of @bulla/registry." };

  const base = tag.slice(1);
  const bump = bumpOf(changes);
  let version = bump ? incVersion(base, bump) : base;
  let manual = false;
  if (compareVersions(packageVersion, version) > 0) [version, manual] = [packageVersion, true];
  if (version === base) return { release: false, version: base, notes: "" };

  const lines = [
    manual ? `${version}, set by hand in package.json (${bump ?? "no"} change detected since ${tag}).` : `${bump} release since ${tag}.`,
    "",
    ...[...changes].sort((x, y) => RANK[y.bump] - RANK[x.bump]).map((c) => `- ${c.bump}: ${c.what}`),
  ];
  return { release: true, version, notes: lines.join("\n") + "\n" };
}

function main() {
  const notesArg = process.argv.indexOf("--notes");
  const notesPath = notesArg > 0 ? process.argv[notesArg + 1] : undefined;

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { version: string };
  const tag = lastReleaseTag();
  const changes = tag ? diffPackage(filesAtTag(tag), filesOnDisk()) : [];
  const result = plan(tag, pkg.version, changes);

  if (result.release && result.version !== pkg.version) {
    // Updates package-lock.json too.
    execFileSync("npm", ["version", result.version, "--no-git-tag-version", "--allow-same-version"], { cwd: ROOT, stdio: "inherit" });
  }

  console.log(result.release ? `Release ${result.version}\n\n${result.notes}` : `Nothing to release since ${tag}.`);
  if (notesPath) writeFileSync(notesPath, result.notes);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release=${result.release}\nversion=${result.version}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && result.release)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## @bulla/registry ${result.version}\n\n${result.notes}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
