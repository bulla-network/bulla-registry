// factoring-contracts' pools.json keeps a record of pools no consumer can read, because their contract has the
// interface of no `version` (e.g. pre-release test deploys), under the category "deprecated". They never reach
// registry.json, so registry.schema.json has no deprecated category and no consumer has to handle one.
export const UNPUBLISHED_CATEGORY = "deprecated";

export function publishedPools<T extends { category?: unknown }>(pools: T[]): T[] {
  return pools.filter((p) => p.category !== UNPUBLISHED_CATEGORY);
}
