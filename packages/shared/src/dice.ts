import { z } from 'zod';

// Dice roll result schema
export const DiceRollResultSchema = z.object({
  formula: z.string(),
  rolls: z.array(z.object({
    dice: z.string(), // e.g., "2d6"
    results: z.array(z.number()),
    kept: z.array(z.number()).optional(), // for drop lowest/highest
    subtotal: z.number(),
  })),
  modifier: z.number(),
  total: z.number(),
  criticalHit: z.boolean().optional(),
  criticalMiss: z.boolean().optional(),
});

export type DiceRollResult = z.infer<typeof DiceRollResultSchema>;

// Individual dice group (e.g., "2d6", "4d6kh3")
interface DiceGroup {
  count: number;
  sides: number;
  keep?: { type: 'highest' | 'lowest'; count: number };
}

// Parsed dice expression
interface ParsedExpression {
  groups: DiceGroup[];
  modifier: number;
  original: string;
}

/**
 * Parse a dice notation string into structured format
 * Supports:
 * - Basic: "2d6", "1d20"
 * - Modifiers: "1d20+5", "2d6-2"
 * - Multiple groups: "2d6+1d4+3"
 * - Keep highest: "4d6kh3" (roll 4d6, keep highest 3)
 * - Keep lowest: "4d6kl1" (roll 4d6, keep lowest 1)
 * - Drop lowest shorthand: "4d6-L" (same as 4d6kh3)
 */
export function parseDiceNotation(notation: string): ParsedExpression | null {
  // Normalize the notation
  const normalized = notation.toLowerCase().replace(/\s+/g, '');

  // Check for the drop lowest shorthand "4d6-L"
  const dropLowestMatch = normalized.match(/^(\d+)d(\d+)-l$/i);
  if (dropLowestMatch) {
    const count = parseInt(dropLowestMatch[1], 10);
    const sides = parseInt(dropLowestMatch[2], 10);
    return {
      groups: [{
        count,
        sides,
        keep: { type: 'highest', count: count - 1 }
      }],
      modifier: 0,
      original: notation,
    };
  }

  // Regex for dice groups: "2d6", "4d6kh3", "4d6kl1"
  const diceRegex = /(\d+)d(\d+)(?:k([hl])(\d+))?/g;

  // Regex for the full expression with modifiers
  const fullRegex = /^((?:\d+d\d+(?:k[hl]\d+)?[+-]?)+)([+-]\d+)?$/;

  const fullMatch = normalized.match(fullRegex);
  if (!fullMatch) {
    // Try simple format without explicit modifier separation
    const simpleMatch = normalized.match(/^(\d+d\d+(?:k[hl]\d+)?)([+-]\d+)?$/);
    if (!simpleMatch) {
      return null;
    }
  }

  const groups: DiceGroup[] = [];
  let match;
  let lastIndex = 0;
  let modifier = 0;

  // Extract all dice groups
  const expressionPart = normalized.replace(/[+-]\d+$/, ''); // Remove trailing modifier
  const modifierMatch = normalized.match(/([+-]\d+)$/);
  if (modifierMatch) {
    modifier = parseInt(modifierMatch[1], 10);
  }

  // Reset regex
  diceRegex.lastIndex = 0;

  while ((match = diceRegex.exec(expressionPart)) !== null) {
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);

    // Validate dice
    if (count < 1 || count > 100) return null;
    if (sides < 2 || sides > 1000) return null;

    const group: DiceGroup = { count, sides };

    // Check for keep modifier
    if (match[3] && match[4]) {
      const keepType = match[3] === 'h' ? 'highest' : 'lowest';
      const keepCount = parseInt(match[4], 10);
      if (keepCount < 1 || keepCount > count) return null;
      group.keep = { type: keepType, count: keepCount };
    }

    groups.push(group);
    lastIndex = diceRegex.lastIndex;
  }

  if (groups.length === 0) {
    return null;
  }

  return {
    groups,
    modifier,
    original: notation,
  };
}

/**
 * Roll a single die with the given number of sides
 */
function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll dice according to the parsed expression
 */
export function rollDice(expression: ParsedExpression): DiceRollResult {
  const rolls: DiceRollResult['rolls'] = [];
  let grandTotal = 0;
  let isCriticalHit = false;
  let isCriticalMiss = false;

  for (const group of expression.groups) {
    const results: number[] = [];

    // Roll all dice in this group
    for (let i = 0; i < group.count; i++) {
      results.push(rollDie(group.sides));
    }

    let kept = results;
    let subtotal: number;

    // Apply keep modifier if present
    if (group.keep) {
      const sorted = [...results].sort((a, b) => a - b);
      if (group.keep.type === 'highest') {
        kept = sorted.slice(-group.keep.count);
      } else {
        kept = sorted.slice(0, group.keep.count);
      }
      subtotal = kept.reduce((sum, val) => sum + val, 0);
    } else {
      subtotal = results.reduce((sum, val) => sum + val, 0);
    }

    // Check for critical hit/miss on d20
    if (group.sides === 20 && group.count === 1 && !group.keep) {
      if (results[0] === 20) isCriticalHit = true;
      if (results[0] === 1) isCriticalMiss = true;
    }

    rolls.push({
      dice: `${group.count}d${group.sides}${group.keep ? `k${group.keep.type[0]}${group.keep.count}` : ''}`,
      results,
      kept: group.keep ? kept : undefined,
      subtotal,
    });

    grandTotal += subtotal;
  }

  grandTotal += expression.modifier;

  return {
    formula: expression.original,
    rolls,
    modifier: expression.modifier,
    total: grandTotal,
    criticalHit: isCriticalHit || undefined,
    criticalMiss: isCriticalMiss || undefined,
  };
}

/**
 * Parse and roll dice from a notation string
 * Returns null if the notation is invalid
 */
export function parseAndRoll(notation: string): DiceRollResult | null {
  const expression = parseDiceNotation(notation);
  if (!expression) {
    return null;
  }
  return rollDice(expression);
}

/**
 * Format a dice roll result as a human-readable string
 */
export function formatRollResult(result: DiceRollResult): string {
  const parts: string[] = [];

  for (const roll of result.rolls) {
    if (roll.kept) {
      // Show which dice were kept
      const keptSet = new Set(roll.kept);
      const formatted = roll.results.map((r, i) => {
        // Find if this result is in kept (handle duplicates)
        const isKept = roll.kept!.includes(r);
        return isKept ? `${r}` : `~~${r}~~`;
      }).join(', ');
      parts.push(`[${formatted}]`);
    } else {
      parts.push(`[${roll.results.join(', ')}]`);
    }
  }

  if (result.modifier !== 0) {
    parts.push(result.modifier > 0 ? `+${result.modifier}` : `${result.modifier}`);
  }

  let resultStr = `${result.formula}: ${parts.join(' ')} = **${result.total}**`;

  if (result.criticalHit) {
    resultStr += ' (Critical Hit!)';
  } else if (result.criticalMiss) {
    resultStr += ' (Critical Miss!)';
  }

  return resultStr;
}

/**
 * Check if a message contains a dice roll command
 * Returns the dice notation if found, null otherwise
 */
export function extractDiceCommand(message: string): string | null {
  // Check for /roll command
  const rollMatch = message.match(/^\/roll\s+(.+)$/i);
  if (rollMatch) {
    return rollMatch[1].trim();
  }

  // Check for /r shorthand
  const rMatch = message.match(/^\/r\s+(.+)$/i);
  if (rMatch) {
    return rMatch[1].trim();
  }

  // Check for inline dice notation wrapped in brackets [[2d6+3]]
  const inlineMatch = message.match(/\[\[([^\]]+)\]\]/);
  if (inlineMatch) {
    return inlineMatch[1].trim();
  }

  return null;
}
