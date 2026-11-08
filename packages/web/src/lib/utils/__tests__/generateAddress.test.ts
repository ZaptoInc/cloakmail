import { describe, test, expect } from 'vitest';
import { generateRandomPrefix, adjectives, nouns } from '../generateAddress';

describe('generateRandomPrefix', () => {
	test('returns a string', () => {
		const result = generateRandomPrefix();
		expect(typeof result).toBe('string');
	});

	test('matches adjective.nounNNNN format', () => {
		const result = generateRandomPrefix();
		expect(result).toMatch(/^[a-z]+\.[a-z]+\d{1,4}$/);
	});

	test('number suffix is between 0 and 9999', () => {
		for (let i = 0; i < 50; i++) {
			const result = generateRandomPrefix();
			const num = parseInt(result.match(/\d+$/)![0], 10);
			expect(num).toBeGreaterThanOrEqual(0);
			expect(num).toBeLessThan(10000);
		}
	});

	test('generates varying output', () => {
		const results = new Set<string>();
		for (let i = 0; i < 20; i++) {
			results.add(generateRandomPrefix());
		}
		// With 100 adjectives * 100 nouns * 10000 numbers = 100M combos,
		// 20 calls should produce at least 2 unique values
		expect(results.size).toBeGreaterThan(1);
	});

	test('word lists are large, lowercase and without duplicates', () => {
		for (const list of [adjectives, nouns]) {
			expect(list.length).toBeGreaterThanOrEqual(100);
			expect(new Set(list).size).toBe(list.length);
			for (const word of list) expect(word).toMatch(/^[a-z]+$/);
		}
	});

	test('uses valid adjective and noun from word lists', () => {
		for (let i = 0; i < 30; i++) {
			const result = generateRandomPrefix();
			const [adj, rest] = result.split('.');
			const noun = rest.replace(/\d+$/, '');
			expect(adjectives).toContain(adj);
			expect(nouns).toContain(noun);
		}
	});
});
