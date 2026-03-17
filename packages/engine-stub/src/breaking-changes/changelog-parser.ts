import type { BreakingChange } from "@mergesignal/shared";

/**
 * Changelog parsing for breaking change detection.
 * 
 * Extracts breaking change information from:
 * - CHANGELOG.md files
 * - GitHub release notes
 * - npm package metadata
 * 
 * Uses keyword matching and heuristics to identify breaking changes.
 */

/**
 * Keywords that indicate breaking changes in changelogs.
 * Ordered by confidence level (highest first).
 */
const BREAKING_CHANGE_KEYWORDS = [
  // High confidence
  'BREAKING CHANGE',
  'BREAKING CHANGES',
  'Breaking Change',
  'Breaking Changes',
  '⚠️ BREAKING',
  '💥 BREAKING',
  
  // Medium confidence
  'breaking:',
  '[BREAKING]',
  'breaking change:',
  'breaking changes:',
  'migration guide',
  'Migration Guide',
  
  // Lower confidence (context-dependent)
  'removed:',
  'deprecated:',
  'renamed:',
];

/**
 * API-related patterns that might indicate affected code.
 * Used to extract affected API names from breaking change descriptions.
 */
const API_PATTERNS = [
  /`([a-zA-Z_$][a-zA-Z0-9_$.]*)`/g,  // Backtick-wrapped identifiers
  /\b(removed|deprecated|renamed)\s+["`']?([a-zA-Z_$][a-zA-Z0-9_$.]+)["`']?/gi,  // "removed XYZ"
  /\b([a-zA-Z_$][a-zA-Z0-9_$.]+)\s+(has been|is now|was)\s+(removed|deprecated|renamed)/gi,  // "XYZ has been removed"
];

/**
 * Parse a changelog text and extract breaking change entries.
 */
export function parseBreakingChanges(changelogText: string): BreakingChange[] {
  if (!changelogText || typeof changelogText !== 'string') {
    return [];
  }
  
  const changes: BreakingChange[] = [];
  const lines = changelogText.split('\n');
  
  let inBreakingSection = false;
  let currentDescription: string[] = [];
  let currentSeverity: 'high' | 'medium' = 'high';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if this line starts a breaking change section
    const matchedKeyword = BREAKING_CHANGE_KEYWORDS.find(keyword => 
      trimmed.includes(keyword)
    );
    
    if (matchedKeyword) {
      // Save previous breaking change if any
      if (inBreakingSection && currentDescription.length > 0) {
        changes.push(createBreakingChange(currentDescription, currentSeverity));
      }
      
      inBreakingSection = true;
      currentDescription = [trimmed];
      currentSeverity = matchedKeyword.toLowerCase().includes('migration') ? 'medium' : 'high';
      continue;
    }
    
    // If we're in a breaking change section, collect lines
    if (inBreakingSection) {
      // End section on blank line, new heading, or different list item
      if (
        trimmed === '' ||
        trimmed.match(/^#{1,6}\s/) ||  // Markdown heading
        (trimmed.match(/^[-*]\s/) && currentDescription.length > 1)  // New list item
      ) {
        if (currentDescription.length > 0) {
          changes.push(createBreakingChange(currentDescription, currentSeverity));
        }
        inBreakingSection = false;
        currentDescription = [];
      } else {
        currentDescription.push(trimmed);
      }
    }
  }
  
  // Save final breaking change if any
  if (inBreakingSection && currentDescription.length > 0) {
    changes.push(createBreakingChange(currentDescription, currentSeverity));
  }
  
  return changes;
}

/**
 * Create a BreakingChange object from collected description lines.
 */
function createBreakingChange(
  descriptionLines: string[],
  severity: 'high' | 'medium'
): BreakingChange {
  const fullDescription = descriptionLines.join(' ').trim();
  const affectedAPIs = extractAffectedAPIs(fullDescription);
  
  return {
    source: 'changelog',
    severity,
    description: fullDescription,
    affectedAPIs: affectedAPIs.length > 0 ? affectedAPIs : undefined,
  };
}

/**
 * Extract affected API names from a breaking change description.
 * Uses pattern matching to identify code symbols mentioned in the text.
 */
export function extractAffectedAPIs(description: string): string[] {
  const apis = new Set<string>();
  
  for (const pattern of API_PATTERNS) {
    const matches = description.matchAll(pattern);
    for (const match of matches) {
      // Extract the captured API name (may be in different capture groups)
      const apiName = match[1] || match[2];
      if (apiName && isValidAPIName(apiName)) {
        apis.add(apiName);
      }
    }
  }
  
  return Array.from(apis);
}

/**
 * Validate that a string looks like a valid API name.
 * Filters out common false positives.
 */
function isValidAPIName(name: string): boolean {
  // Filter out common non-API words
  const blocklist = new Set([
    'removed', 'deprecated', 'renamed', 'changed', 'updated',
    'has', 'been', 'is', 'was', 'now', 'the', 'a', 'an',
  ]);
  
  if (blocklist.has(name.toLowerCase())) {
    return false;
  }
  
  // Must be at least 2 characters
  if (name.length < 2) {
    return false;
  }
  
  // Should start with letter or $/_
  if (!/^[a-zA-Z_$]/.test(name)) {
    return false;
  }
  
  return true;
}

/**
 * Fetch changelog content from various sources.
 * Priority: GitHub releases API → CHANGELOG.md → package.json description
 */
export async function fetchChangelog(
  packageName: string,
  version: string
): Promise<string | null> {
  // For MVP, this is a stub that returns null
  // Future implementation will:
  // 1. Check GitHub releases API for the version
  // 2. Fetch CHANGELOG.md from the package repository
  // 3. Parse npm package metadata
  
  // TODO: Implement actual changelog fetching
  // - Use GitHub API with authentication
  // - Cache results aggressively (30 days TTL)
  // - Handle rate limits gracefully
  
  return null;
}
