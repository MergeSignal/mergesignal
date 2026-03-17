import { describe, it, expect, beforeEach } from 'vitest';
import { detectBreakingChanges, detectBreakingChangesForUpgrades } from './detector.js';
import { breakingChangeCache } from './sources/cache.js';

describe('detectBreakingChanges', () => {
  beforeEach(() => {
    breakingChangeCache.clear();
  });

  it('detects major version bumps', async () => {
    const changes = await detectBreakingChanges({
      name: 'express',
      fromVersion: '4.18.0',
      toVersion: '5.0.0',
    }, { skipChangelog: true });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      source: 'semver',
      severity: 'high',
      description: expect.stringContaining('Major version upgrade'),
    });
  });

  it('detects pre-1.0 minor bumps', async () => {
    const changes = await detectBreakingChanges({
      name: 'some-lib',
      fromVersion: '0.5.0',
      toVersion: '0.6.0',
    }, { skipChangelog: true });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      source: 'semver',
      severity: 'medium',
      description: expect.stringContaining('Pre-1.0 minor version bump'),
    });
  });

  it('returns empty array for patch bumps', async () => {
    const changes = await detectBreakingChanges({
      name: 'lodash',
      fromVersion: '4.17.0',
      toVersion: '4.17.21',
    }, { skipChangelog: true });

    expect(changes).toHaveLength(0);
  });

  it('caches results by default', async () => {
    const upgrade = {
      name: 'react',
      fromVersion: '17.0.0',
      toVersion: '18.0.0',
    };

    const firstCall = await detectBreakingChanges(upgrade, { skipChangelog: true });
    const secondCall = await detectBreakingChanges(upgrade, { skipChangelog: true });

    expect(firstCall).toEqual(secondCall);
    
    // Verify cache was hit
    const cached = breakingChangeCache.get({
      packageName: upgrade.name,
      fromVersion: upgrade.fromVersion,
      toVersion: upgrade.toVersion,
    });
    expect(cached).toEqual(firstCall);
  });

  it('skips cache when requested', async () => {
    const upgrade = {
      name: 'vue',
      fromVersion: '2.7.0',
      toVersion: '3.0.0',
    };

    await detectBreakingChanges(upgrade, { skipChangelog: true });
    const result = await detectBreakingChanges(upgrade, { skipCache: true, skipChangelog: true });

    expect(result).toHaveLength(1);
  });

  it('deduplicates identical changes', async () => {
    // This would happen if both semver and changelog detect the same breaking change
    const changes = await detectBreakingChanges({
      name: 'test-pkg',
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
    }, { skipChangelog: true });

    const descriptions = changes.map(c => c.description);
    const uniqueDescriptions = new Set(descriptions);
    
    expect(descriptions.length).toBe(uniqueDescriptions.size);
  });
});

describe('detectBreakingChangesForUpgrades', () => {
  beforeEach(() => {
    breakingChangeCache.clear();
  });

  it('processes multiple upgrades in parallel', async () => {
    const upgrades = [
      { name: 'express', fromVersion: '4.0.0', toVersion: '5.0.0' },
      { name: 'react', fromVersion: '17.0.0', toVersion: '18.0.0' },
      { name: 'lodash', fromVersion: '4.17.0', toVersion: '4.17.21' },
    ];

    const results = await detectBreakingChangesForUpgrades(upgrades, { skipChangelog: true });

    expect(results.size).toBe(3);
    expect(results.get('express')).toHaveLength(1);
    expect(results.get('react')).toHaveLength(1);
    expect(results.get('lodash')).toHaveLength(0);
  });

  it('returns empty map for empty input', async () => {
    const results = await detectBreakingChangesForUpgrades([], { skipChangelog: true });
    expect(results.size).toBe(0);
  });
});
