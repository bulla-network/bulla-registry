import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import {
  bumpOf,
  diffAbi,
  diffPackage,
  diffRegistry,
  diffSchema,
  filesOnDisk,
  incVersion,
  plan,
  type Change,
} from "./release-version.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf-8"));
const registry = () => structuredClone(read("registry.json"));
const schema = () => structuredClone(read("registry.schema.json"));

const bump = (changes: Change[]) => bumpOf(changes);

test("versions", () => {
  assert.equal(incVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(incVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(incVersion("1.2.3", "major"), "2.0.0");
});

test("only generatedAt changed: nothing to release", () => {
  const r = registry();
  r.generatedAt = "2030-01-01T00:00:00.000Z";
  assert.deepEqual(diffRegistry(registry(), r), []);
});

test("a changed address or endpoint is a patch", () => {
  const r = registry();
  r.networks["1"].contracts["bulla-contracts-v2"].bullaInvoice = "0x0000000000000000000000000000000000000001";
  assert.equal(bump(diffRegistry(registry(), r)), "patch");

  const r2 = registry();
  r2.networks["8453"].subgraph.prod = "https://example.com/gn";
  assert.equal(bump(diffRegistry(registry(), r2)), "patch");

  const r3 = registry();
  r3.pools[0].category = r3.pools[0].category === "active" ? "archived" : "active";
  assert.equal(bump(diffRegistry(registry(), r3)), "patch");
});

test("a new network, contract, pool or client is a minor", () => {
  const r = registry();
  r.networks["999"] = { ...r.networks["1"], chainId: 999 };
  assert.equal(bump(diffRegistry(registry(), r)), "minor");

  const r2 = registry();
  r2.networks["1"].contracts["bulla-contracts-v2"].newThing = "0x0000000000000000000000000000000000000001";
  assert.equal(bump(diffRegistry(registry(), r2)), "minor");

  const r3 = registry();
  r3.networks["1"].contracts["factoring-contracts"] = { thing: "0x0000000000000000000000000000000000000001" };
  assert.equal(bump(diffRegistry(registry(), r3)), "minor");

  const r4 = registry();
  r4.pools.push({ ...r4.pools[0], address: "0x0000000000000000000000000000000000000001" });
  assert.equal(bump(diffRegistry(registry(), r4)), "minor");

  const r5 = registry();
  r5.clients["new-client"] = { displayName: "New" };
  assert.equal(bump(diffRegistry(registry(), r5)), "minor");
});

test("pools are matched by chain and address, not position", () => {
  const r = registry();
  r.pools.reverse();
  assert.deepEqual(diffRegistry(registry(), r), []);

  const r2 = registry();
  r2.pools[0].address = r2.pools[0].address.toLowerCase();
  assert.deepEqual(
    diffRegistry(registry(), r2).map((c) => c.bump),
    registry().pools[0].address === r2.pools[0].address ? [] : ["patch"],
  );
});

test("a removed network, contract, pool or client is a major", () => {
  const r = registry();
  delete r.networks["10"];
  assert.equal(bump(diffRegistry(registry(), r)), "major");

  const r2 = registry();
  delete r2.networks["1"].contracts["bulla-contracts-v2"].bullaInvoice;
  assert.equal(bump(diffRegistry(registry(), r2)), "major");

  const r3 = registry();
  r3.pools.pop();
  assert.equal(bump(diffRegistry(registry(), r3)), "major");

  const r4 = registry();
  delete r4.clients[Object.keys(r4.clients)[0]];
  assert.equal(bump(diffRegistry(registry(), r4)), "major");
});

test("an optional value appearing on a pool is a patch: the field already exists", () => {
  const r = registry();
  const pool = r.pools.find((p: { supersededBy?: string }) => !p.supersededBy);
  pool.supersededBy = "0x0000000000000000000000000000000000000001";
  assert.equal(bump(diffRegistry(registry(), r)), "patch");
});

test("schema: a new field is a minor, a removed or renamed one a major", () => {
  const s = schema();
  s.definitions.network.properties.explorer = { type: "string" };
  assert.equal(bump(diffSchema(schema(), s)), "minor");

  const s2 = schema();
  delete s2.definitions.pool.properties.deployBlock;
  assert.equal(bump(diffSchema(schema(), s2)), "major");

  const s3 = schema();
  s3.definitions.subgraphEndpoints.properties.production = s3.definitions.subgraphEndpoints.properties.prod;
  delete s3.definitions.subgraphEndpoints.properties.prod;
  assert.equal(bump(diffSchema(schema(), s3)), "major");
});

test("schema: a field becoming optional or an enum losing a value is a major", () => {
  const s = schema();
  s.definitions.pool.required = s.definitions.pool.required.filter((f: string) => f !== "deployBlock");
  assert.equal(bump(diffSchema(schema(), s)), "major");

  const s2 = schema();
  s2.definitions.pool.properties.version.enum.push("V3");
  assert.equal(bump(diffSchema(schema(), s2)), "minor");

  const s3 = schema();
  s3.definitions.pool.properties.version.enum.shift();
  assert.equal(bump(diffSchema(schema(), s3)), "major");

  const s4 = schema();
  s4.definitions.client.description = "Reworded.";
  assert.equal(bump(diffSchema(schema(), s4)), "patch");
});

test("ABIs: an added function is a minor, a removed one a major, another abi change a patch, bytecode nothing", () => {
  const abi = [
    { type: "constructor", inputs: [] },
    { type: "function", name: "pay", inputs: [{ type: "uint256", name: "id" }], outputs: [] },
  ];
  const added = [...abi, { type: "event", name: "Paid", inputs: [{ type: "uint256", name: "id" }] }];
  assert.equal(bump(diffAbi("x/abis/A.json", abi, added)), "minor");
  assert.equal(bump(diffAbi("x/abis/A.json", { abi: added }, { abi })), "major");

  const overloaded = [...abi.slice(0, 1), { ...abi[1], inputs: [{ type: "uint256", name: "id" }, { type: "address", name: "to" }] }];
  assert.equal(bump(diffAbi("x/abis/A.json", abi, overloaded)), "major");

  const renamedParam = [...abi.slice(0, 1), { ...abi[1], inputs: [{ type: "uint256", name: "claimId" }] }];
  assert.equal(bump(diffAbi("x/abis/A.json", abi, renamedParam)), "patch");
  assert.deepEqual(diffAbi("x/abis/A.json", { abi, bytecode: "0x00" }, { abi, bytecode: "0x01" }), []);
});

test("package files: a new ABI is a minor, a removed one a major", () => {
  const before = filesOnDisk();
  assert.ok(before.has("registry.json") && before.has("registry.schema.json"));
  assert.ok([...before.keys()].some((p) => p.includes("/abis/")));
  assert.ok(![...before.keys()].some((p) => p.includes("/skills/") || p.includes("/logos/") || p.startsWith("dist/")));

  const added = new Map(before).set("bulla-contracts-v2/abis/New.json", Buffer.from("[]"));
  assert.equal(bump(diffPackage(before, added)), "minor");

  const removed = new Map(before);
  removed.delete([...before.keys()].find((p) => p.includes("/abis/"))!);
  assert.equal(bump(diffPackage(before, removed)), "major");

  assert.deepEqual(diffPackage(before, new Map(before)), []);
});

test("plan: no change since the tag releases nothing; a version set by hand wins", () => {
  assert.deepEqual(plan("v1.2.0", "1.2.0", []), { release: false, version: "1.2.0", notes: "" });
  assert.equal(plan("v1.2.0", "1.2.0", [{ bump: "minor", what: "x" }]).version, "1.3.0");
  // The bump was already written to package.json by a run whose publish failed: release it again.
  assert.equal(plan("v1.2.0", "1.3.0", [{ bump: "minor", what: "x" }]).version, "1.3.0");
  assert.deepEqual([plan("v1.2.0", "2.0.0", []).release, plan("v1.2.0", "2.0.0", []).version], [true, "2.0.0"]);
  assert.deepEqual([plan(null, "1.0.0", []).release, plan(null, "1.0.0", []).version], [true, "1.0.0"]);
});

// The commit that dropped networks[].graphql (6dc2aa8) removed a field consumers read: a major.
test("history: dropping networks[].graphql is a major", (t) => {
  const show = (rev: string, path: string) => {
    try {
      return JSON.parse(execFileSync("git", ["show", `${rev}:${path}`], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString());
    } catch {
      return null;
    }
  };
  const [before, after] = [show("6dc2aa8^", "registry.schema.json"), show("6dc2aa8", "registry.schema.json")];
  if (!before || !after) return t.skip("commit not in this clone");
  const changes = diffSchema(before, after);
  assert.equal(bumpOf(changes), "major");
  assert.ok(changes.some((c) => /removed field .*graphql/.test(c.what)), changes.map((c) => c.what).join("\n"));
});
