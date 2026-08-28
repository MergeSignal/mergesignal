import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulateUpgrade } from "../dist/stub.js";

const upgradeRequest = {
  repoId: "demo/repo",
  currentLockfile: {
    manager: "pnpm" as const,
    content: "lockfileVersion: '9.0'\n",
    path: "pnpm-lock.yaml",
  },
};

describe("engine-stub simulateUpgrade", () => {
  it("returns repository-scoped before/after with explicit finite root scores", async () => {
    const result = await simulateUpgrade(upgradeRequest);

    assert.equal(result.before.totalScore, 25);
    assert.equal(result.after?.totalScore, 30);
    assert.equal(Number.isFinite(result.before.totalScore), true);
    assert.equal(Number.isFinite(result.after?.totalScore ?? NaN), true);
    assert.equal(result.delta?.totalScoreDelta, 5);
    assert.ok(result.generatedAt);
  });

  it("does not emit modern PR Risk wires on the upgrade simulation path", async () => {
    const result = await simulateUpgrade(upgradeRequest);

    assert.equal(result.before.prRisk, undefined);
    assert.equal(result.after?.prRisk, undefined);
    assert.equal(result.before.repositoryHealth, undefined);
    assert.equal(result.after?.repositoryHealth, undefined);
  });
});
