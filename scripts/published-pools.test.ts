import { test } from "node:test";
import assert from "node:assert/strict";
import { publishedPools } from "./published-pools.ts";

test("deprecated pools are left out, and every other category is kept, in order", () => {
  const pools = ["active", "deprecated", "test", "archived", "deprecated", "hidden"].map((category, i) => ({ i, category }));
  assert.deepEqual(
    publishedPools(pools).map((p) => p.category),
    ["active", "test", "archived", "hidden"]
  );
  assert.deepEqual(publishedPools(pools).map((p) => p.i), [0, 2, 3, 5]);
});
