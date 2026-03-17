import { describe, it, expect } from 'vitest';
import { parseBreakingChanges, extractAffectedAPIs } from './changelog-parser.js';

describe('parseBreakingChanges', () => {
  it('extracts breaking changes from changelog with BREAKING CHANGE header', () => {
    const changelog = `
# v2.0.0

## BREAKING CHANGES

- Removed deprecated \`app.use()\` signature
- Renamed \`listen()\` to \`start()\`
`;

    const changes = parseBreakingChanges(changelog);
    
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]).toMatchObject({
      source: 'changelog',
      severity: 'high',
    });
    expect(changes[0].description).toContain('Removed');
  });

  it('extracts breaking changes with emoji markers', () => {
    const changelog = `
# Release Notes

⚠️ BREAKING: The authentication API has changed
`;

    const changes = parseBreakingChanges(changelog);
    
    expect(changes).toHaveLength(1);
    expect(changes[0].description).toContain('authentication API');
  });

  it('handles multiple breaking change sections', () => {
    const changelog = `
# v3.0.0

## BREAKING CHANGES
- API change 1

## Features
- New feature

BREAKING CHANGE: API change 2
`;

    const changes = parseBreakingChanges(changelog);
    
    expect(changes.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for changelog without breaking changes', () => {
    const changelog = `
# v1.5.0

## Features
- Added new feature
- Improved performance

## Bug Fixes
- Fixed bug 1
- Fixed bug 2
`;

    const changes = parseBreakingChanges(changelog);
    
    expect(changes).toHaveLength(0);
  });

  it('handles migration guide references', () => {
    const changelog = `
# v2.0.0

Migration Guide: See MIGRATION.md for details on upgrading from v1.x
`;

    const changes = parseBreakingChanges(changelog);
    
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]).toMatchObject({
      source: 'changelog',
      severity: 'medium', // Migration guides are medium severity
    });
  });

  it('handles empty or null input', () => {
    expect(parseBreakingChanges('')).toHaveLength(0);
    expect(parseBreakingChanges(null as any)).toHaveLength(0);
    expect(parseBreakingChanges(undefined as any)).toHaveLength(0);
  });
});

describe('extractAffectedAPIs', () => {
  it('extracts APIs from backtick-wrapped identifiers', () => {
    const description = 'Removed `app.use()` and deprecated `listen()` method';
    const apis = extractAffectedAPIs(description);
    
    expect(apis).toContain('app.use()');
    expect(apis).toContain('listen()');
  });

  it('extracts APIs from "removed X" patterns', () => {
    const description = 'removed createServer function and deprecated startApp';
    const apis = extractAffectedAPIs(description);
    
    expect(apis.length).toBeGreaterThan(0);
    expect(apis.some(api => api.includes('createServer') || api.includes('startApp'))).toBe(true);
  });

  it('extracts APIs from "X has been removed" patterns', () => {
    const description = 'Router has been removed from the main export';
    const apis = extractAffectedAPIs(description);
    
    expect(apis).toContain('Router');
  });

  it('filters out common non-API words', () => {
    const description = 'removed the deprecated API';
    const apis = extractAffectedAPIs(description);
    
    expect(apis).not.toContain('removed');
    expect(apis).not.toContain('the');
    expect(apis).not.toContain('deprecated');
  });

  it('handles descriptions with no APIs', () => {
    const description = 'Major refactoring of internal implementation';
    const apis = extractAffectedAPIs(description);
    
    // Should either be empty or only contain valid-looking identifiers
    apis.forEach(api => {
      expect(api.length).toBeGreaterThan(1);
      expect(/^[a-zA-Z_$]/.test(api)).toBe(true);
    });
  });

  it('extracts multiple APIs from complex descriptions', () => {
    const description = 'Breaking: `app.listen()` removed, use `app.start()` instead. Also deprecated `middleware.use()`';
    const apis = extractAffectedAPIs(description);
    
    expect(apis.length).toBeGreaterThan(0);
    expect(apis.some(api => api.includes('listen') || api.includes('start') || api.includes('use'))).toBe(true);
  });

  it('handles camelCase and PascalCase identifiers', () => {
    const description = 'Removed `myFunction` and `MyClass` from exports';
    const apis = extractAffectedAPIs(description);
    
    expect(apis).toContain('myFunction');
    expect(apis).toContain('MyClass');
  });
});
