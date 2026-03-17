import { describe, it, expect } from 'vitest';
import { parseSemver, isMajorBump, isPreOneBump, analyzeSemverBreakingChanges } from './semver-analyzer.js';

describe('parseSemver', () => {
  it('parses standard semver versions', () => {
    expect(parseSemver('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
  });

  it('parses versions with v prefix', () => {
    expect(parseSemver('v2.5.1')).toEqual({
      major: 2,
      minor: 5,
      patch: 1,
      prerelease: undefined,
    });
  });

  it('parses versions with prerelease', () => {
    expect(parseSemver('1.0.0-beta.1')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: 'beta.1',
    });
  });

  it('parses versions with range operators', () => {
    expect(parseSemver('^1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });

    expect(parseSemver('~1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });

    expect(parseSemver('>=1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
  });

  it('returns null for invalid versions', () => {
    expect(parseSemver('invalid')).toBeNull();
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('1')).toBeNull();
    expect(parseSemver('')).toBeNull();
  });
});

describe('isMajorBump', () => {
  it('detects major version bumps', () => {
    expect(isMajorBump('1.0.0', '2.0.0')).toBe(true);
    expect(isMajorBump('1.5.3', '2.0.0')).toBe(true);
    expect(isMajorBump('5.1.2', '6.0.0')).toBe(true);
  });

  it('returns false for non-major bumps', () => {
    expect(isMajorBump('1.0.0', '1.1.0')).toBe(false);
    expect(isMajorBump('1.0.0', '1.0.1')).toBe(false);
    expect(isMajorBump('2.5.0', '2.5.1')).toBe(false);
  });

  it('returns false for same version', () => {
    expect(isMajorBump('1.0.0', '1.0.0')).toBe(false);
  });

  it('handles version prefixes and operators', () => {
    expect(isMajorBump('v1.0.0', 'v2.0.0')).toBe(true);
    expect(isMajorBump('^1.0.0', '^2.0.0')).toBe(true);
    expect(isMajorBump('~1.0.0', '~2.0.0')).toBe(true);
  });

  it('returns false for invalid versions', () => {
    expect(isMajorBump('invalid', '2.0.0')).toBe(false);
    expect(isMajorBump('1.0.0', 'invalid')).toBe(false);
  });
});

describe('isPreOneBump', () => {
  it('detects pre-1.0 minor bumps', () => {
    expect(isPreOneBump('0.5.0', '0.6.0')).toBe(true);
    expect(isPreOneBump('0.1.0', '0.2.0')).toBe(true);
    expect(isPreOneBump('0.12.5', '0.13.0')).toBe(true);
  });

  it('returns false for patch bumps', () => {
    expect(isPreOneBump('0.5.0', '0.5.1')).toBe(false);
    expect(isPreOneBump('0.1.2', '0.1.3')).toBe(false);
  });

  it('returns false for non-0.x versions', () => {
    expect(isPreOneBump('1.0.0', '1.1.0')).toBe(false);
    expect(isPreOneBump('2.5.0', '2.6.0')).toBe(false);
  });

  it('returns false when crossing to 1.x', () => {
    expect(isPreOneBump('0.9.0', '1.0.0')).toBe(false);
  });

  it('returns false for invalid versions', () => {
    expect(isPreOneBump('invalid', '0.6.0')).toBe(false);
    expect(isPreOneBump('0.5.0', 'invalid')).toBe(false);
  });
});

describe('analyzeSemverBreakingChanges', () => {
  it('returns high severity for major bumps', () => {
    const changes = analyzeSemverBreakingChanges('express', '4.0.0', '5.0.0');
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      source: 'semver',
      severity: 'high',
      description: expect.stringContaining('Major version upgrade'),
    });
  });

  it('returns medium severity for pre-1.0 minor bumps', () => {
    const changes = analyzeSemverBreakingChanges('some-lib', '0.5.0', '0.6.0');
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      source: 'semver',
      severity: 'medium',
      description: expect.stringContaining('Pre-1.0 minor version bump'),
    });
  });

  it('returns empty array for patch bumps', () => {
    const changes = analyzeSemverBreakingChanges('lodash', '4.17.0', '4.17.21');
    expect(changes).toHaveLength(0);
  });

  it('returns empty array for minor bumps in stable versions', () => {
    const changes = analyzeSemverBreakingChanges('react', '17.0.0', '17.1.0');
    expect(changes).toHaveLength(0);
  });

  it('includes version numbers in description', () => {
    const changes = analyzeSemverBreakingChanges('vue', '2.0.0', '3.0.0');
    
    expect(changes[0].description).toContain('2.0.0');
    expect(changes[0].description).toContain('3.0.0');
  });
});
