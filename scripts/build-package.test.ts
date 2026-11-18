// Packs @bulla/registry as npm would publish it, installs the tarball in a scratch project, and uses it the way
// consumers do: import (ESM), require (CommonJS), the JSON files by path, and the types, type-checked by tsc.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function run(cmd: string, args: string[], cwd: string): string {
  try {
    return execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${stdout ?? ""}${stderr ?? ""}`);
  }
}

test("the packed package works from ESM, CommonJS and TypeScript", { timeout: 120_000 }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bulla-registry-pack-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // prepack builds dist/; its log comes before the JSON.
  const packed = run("npm", ["pack", "--json", "--pack-destination", dir], ROOT);
  const [{ filename, files }] = JSON.parse(packed.slice(packed.indexOf("[")));
  const paths: string[] = files.map((f: { path: string }) => f.path);
  for (const p of ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "dist/index.d.cts", "registry.json", "registry.schema.json"])
    assert.ok(paths.includes(p), `${p} is in the package`);
  assert.ok(paths.some((p) => /^[^/]+\/abis\/.+\.json$/.test(p)), "ABIs are in the package");
  // Not shipped: the client logos (the frontend keeps its own), skills, scripts.
  assert.ok(
    !paths.some((p) => p.startsWith("scripts/") || p.includes("/skills/") || p.includes("/logos/") || p.startsWith("node_modules/")),
    paths.join("\n"),
  );

  const app = join(dir, "app");
  mkdirSync(app);
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "app", private: true, type: "module" }));
  run("npm", ["install", "--no-audit", "--no-fund", "--offline", join(dir, filename)], app);

  const committed = JSON.parse(readFileSync(join(ROOT, "registry.json"), "utf-8"));

  writeFileSync(
    join(app, "esm.mts"),
    `import registry, { registry as named, type Address, type Pool } from "@bulla/registry";
import schema from "@bulla/registry/registry.schema.json" with { type: "json" };
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const invoice: Address | undefined = registry.networks["1"]?.contracts["bulla-contracts-v2"]?.bullaInvoice;
const active: Pool[] = named.pools.filter((p) => p.category === "active");
const abi: unknown = require("@bulla/registry/bulla-contracts-v2/abis/BullaInvoice.json");
console.log(JSON.stringify({ invoice, active: active.length, same: registry === named, title: schema.title, abi: !!abi, registry }));
`,
  );
  writeFileSync(
    join(app, "cjs.cts"),
    `import reg = require("@bulla/registry");
const prod: string | undefined = reg.registry.networks["8453"]?.subgraph.prod;
console.log(JSON.stringify({ prod, same: reg.default === reg.registry }));
`,
  );
  writeFileSync(
    join(app, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "nodenext", target: "es2022", strict: true, resolveJsonModule: true, outDir: "out", skipLibCheck: false, typeRoots: [join(ROOT, "node_modules/@types")], types: ["node"] },
      files: ["esm.mts", "cjs.cts"],
    }),
  );
  // Fails on any type error in the consumer files or in the package's declarations.
  run(process.execPath, [join(ROOT, "node_modules/typescript/bin/tsc"), "-p", "."], app);

  const esm = JSON.parse(run(process.execPath, ["out/esm.mjs"], app));
  assert.equal(esm.invoice, committed.networks["1"].contracts["bulla-contracts-v2"].bullaInvoice);
  assert.equal(esm.same, true);
  assert.equal(esm.title, "Bulla registry");
  assert.deepEqual(esm.registry, committed);
  assert.ok(esm.abi);

  const cjs = JSON.parse(run(process.execPath, ["out/cjs.cjs"], app));
  assert.deepEqual(cjs, { prod: committed.networks["8453"].subgraph.prod, same: true });
});
