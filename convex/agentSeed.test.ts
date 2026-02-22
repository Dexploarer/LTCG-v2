import { describe, expect, it } from "vitest";
import {
	buildDeckSeedPart,
	buildDeterministicSeed,
	buildMatchSeed,
	makeRng,
} from "./agentSeed";

describe("agent seed helpers", () => {
	it("builds deterministic seeds from string input", () => {
		const a = buildDeterministicSeed("abc");
		const b = buildDeterministicSeed("abc");
		const c = buildDeterministicSeed("abcd");
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});

	it("builds deterministic match seeds from part arrays", () => {
		const a = buildMatchSeed(["agentStartDuel", 1, 2, "deckA"]);
		const b = buildMatchSeed(["agentStartDuel", 1, 2, "deckA"]);
		expect(a).toBe(b);
	});

	it("builds deck seed parts that change with card order/content", () => {
		const base = buildDeckSeedPart(["a", "b", "c"]);
		const reordered = buildDeckSeedPart(["b", "a", "c"]);
		const changed = buildDeckSeedPart(["a", "b", "d"]);
		expect(base).not.toBe(reordered);
		expect(base).not.toBe(changed);
	});

	it("produces stable RNG sequence for a seed", () => {
		const rngA = makeRng(1234);
		const rngB = makeRng(1234);
		const seqA = [rngA(), rngA(), rngA()];
		const seqB = [rngB(), rngB(), rngB()];
		expect(seqA).toEqual(seqB);
	});
});
