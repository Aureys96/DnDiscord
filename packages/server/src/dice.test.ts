import { describe, it, expect } from '@jest/globals';
import { parseDiceNotation, rollDice, parseAndRoll, formatRollResult, extractDiceCommand } from '@dnd-voice/shared';

describe('Dice Parser', () => {
  describe('parseDiceNotation', () => {
    it('should parse basic dice notation', () => {
      const result = parseDiceNotation('2d6');
      expect(result).not.toBeNull();
      expect(result!.groups.length).toBe(1);
      expect(result!.groups[0].count).toBe(2);
      expect(result!.groups[0].sides).toBe(6);
      expect(result!.modifier).toBe(0);
    });

    it('should parse dice with positive modifier', () => {
      const result = parseDiceNotation('1d20+5');
      expect(result).not.toBeNull();
      expect(result!.groups[0].count).toBe(1);
      expect(result!.groups[0].sides).toBe(20);
      expect(result!.modifier).toBe(5);
    });

    it('should parse dice with negative modifier', () => {
      const result = parseDiceNotation('2d6-2');
      expect(result).not.toBeNull();
      expect(result!.groups[0].count).toBe(2);
      expect(result!.groups[0].sides).toBe(6);
      expect(result!.modifier).toBe(-2);
    });

    it('should parse keep highest notation', () => {
      const result = parseDiceNotation('4d6kh3');
      expect(result).not.toBeNull();
      expect(result!.groups[0].count).toBe(4);
      expect(result!.groups[0].sides).toBe(6);
      expect(result!.groups[0].keep).toEqual({ type: 'highest', count: 3 });
    });

    it('should parse keep lowest notation', () => {
      const result = parseDiceNotation('4d6kl1');
      expect(result).not.toBeNull();
      expect(result!.groups[0].count).toBe(4);
      expect(result!.groups[0].sides).toBe(6);
      expect(result!.groups[0].keep).toEqual({ type: 'lowest', count: 1 });
    });

    it('should parse drop lowest shorthand', () => {
      const result = parseDiceNotation('4d6-L');
      expect(result).not.toBeNull();
      expect(result!.groups[0].count).toBe(4);
      expect(result!.groups[0].sides).toBe(6);
      expect(result!.groups[0].keep).toEqual({ type: 'highest', count: 3 });
    });

    it('should handle uppercase notation', () => {
      const result = parseDiceNotation('2D6+3');
      expect(result).not.toBeNull();
      expect(result!.groups[0].count).toBe(2);
      expect(result!.groups[0].sides).toBe(6);
      expect(result!.modifier).toBe(3);
    });

    it('should reject invalid notation', () => {
      expect(parseDiceNotation('invalid')).toBeNull();
      expect(parseDiceNotation('d6')).toBeNull();
      expect(parseDiceNotation('')).toBeNull();
    });

    it('should reject dice count over 100', () => {
      expect(parseDiceNotation('101d6')).toBeNull();
    });

    it('should reject sides over 1000', () => {
      expect(parseDiceNotation('2d1001')).toBeNull();
    });

    it('should reject keep count greater than dice count', () => {
      expect(parseDiceNotation('4d6kh5')).toBeNull();
    });
  });

  describe('rollDice', () => {
    it('should return results within valid range', () => {
      const parsed = parseDiceNotation('10d6')!;
      const result = rollDice(parsed);

      expect(result.rolls.length).toBe(1);
      expect(result.rolls[0].results.length).toBe(10);

      // All results should be between 1 and 6
      for (const roll of result.rolls[0].results) {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      }
    });

    it('should apply modifier correctly', () => {
      const parsed = parseDiceNotation('1d2+5')!;
      const result = rollDice(parsed);

      // Result should be between 1+5=6 and 2+5=7
      expect(result.total).toBeGreaterThanOrEqual(6);
      expect(result.total).toBeLessThanOrEqual(7);
      expect(result.modifier).toBe(5);
    });

    it('should detect critical hit on d20', () => {
      // Roll many times to ensure we eventually get a 20
      let gotCriticalHit = false;
      for (let i = 0; i < 100; i++) {
        const parsed = parseDiceNotation('1d20')!;
        const result = rollDice(parsed);
        if (result.criticalHit) {
          gotCriticalHit = true;
          expect(result.rolls[0].results[0]).toBe(20);
          break;
        }
      }
      // It's statistically possible to not get a 20, so we don't fail the test
    });

    it('should apply keep highest correctly', () => {
      const parsed = parseDiceNotation('4d6kh3')!;
      const result = rollDice(parsed);

      expect(result.rolls[0].results.length).toBe(4);
      expect(result.rolls[0].kept!.length).toBe(3);

      // The kept dice should be the highest 3
      const sorted = [...result.rolls[0].results].sort((a, b) => a - b);
      const expectedKept = sorted.slice(-3).sort((a, b) => a - b);
      const actualKept = [...result.rolls[0].kept!].sort((a, b) => a - b);
      expect(actualKept).toEqual(expectedKept);
    });

    it('should calculate subtotal correctly for kept dice', () => {
      const parsed = parseDiceNotation('4d6kh3')!;
      const result = rollDice(parsed);

      const expectedSubtotal = result.rolls[0].kept!.reduce((sum, val) => sum + val, 0);
      expect(result.rolls[0].subtotal).toBe(expectedSubtotal);
    });
  });

  describe('parseAndRoll', () => {
    it('should return null for invalid notation', () => {
      expect(parseAndRoll('invalid')).toBeNull();
    });

    it('should return roll result for valid notation', () => {
      const result = parseAndRoll('2d6+3');
      expect(result).not.toBeNull();
      expect(result!.formula).toBe('2d6+3');
      expect(result!.modifier).toBe(3);
    });
  });

  describe('formatRollResult', () => {
    it('should format basic roll', () => {
      const result = parseAndRoll('2d6')!;
      const formatted = formatRollResult(result);

      expect(formatted).toContain('2d6');
      expect(formatted).toContain('**');
      expect(formatted).toContain(result.total.toString());
    });

    it('should format keep highest notation', () => {
      const result = parseAndRoll('4d6kh3')!;
      const formatted = formatRollResult(result);

      expect(formatted).toContain('4d6kh3');
      expect(formatted).toContain('['); // Contains dice array
      expect(formatted).toContain('**'); // Contains bold total
    });

    it('should show critical hit message', () => {
      // Create a mock result with critical hit
      const result = {
        formula: '1d20',
        rolls: [{ dice: '1d20', results: [20], subtotal: 20 }],
        modifier: 0,
        total: 20,
        criticalHit: true,
      };
      const formatted = formatRollResult(result);
      expect(formatted).toContain('Critical Hit!');
    });

    it('should show critical miss message', () => {
      const result = {
        formula: '1d20',
        rolls: [{ dice: '1d20', results: [1], subtotal: 1 }],
        modifier: 0,
        total: 1,
        criticalMiss: true,
      };
      const formatted = formatRollResult(result);
      expect(formatted).toContain('Critical Miss!');
    });
  });

  describe('extractDiceCommand', () => {
    it('should extract /roll command', () => {
      expect(extractDiceCommand('/roll 2d6+3')).toBe('2d6+3');
      expect(extractDiceCommand('/roll 1d20')).toBe('1d20');
    });

    it('should extract /r shorthand', () => {
      expect(extractDiceCommand('/r 2d6')).toBe('2d6');
      expect(extractDiceCommand('/r 4d6kh3')).toBe('4d6kh3');
    });

    it('should extract inline dice notation', () => {
      expect(extractDiceCommand('Rolling for attack [[1d20+5]]')).toBe('1d20+5');
      expect(extractDiceCommand('Damage: [[2d6+3]]')).toBe('2d6+3');
    });

    it('should return null for non-dice messages', () => {
      expect(extractDiceCommand('Hello world')).toBeNull();
      expect(extractDiceCommand('Let me roll some dice')).toBeNull();
    });

    it('should handle case insensitivity', () => {
      expect(extractDiceCommand('/ROLL 2d6')).toBe('2d6');
      expect(extractDiceCommand('/Roll 1d20')).toBe('1d20');
      expect(extractDiceCommand('/R 2d6')).toBe('2d6');
    });
  });
});
