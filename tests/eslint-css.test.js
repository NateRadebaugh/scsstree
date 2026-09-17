/**
 * @fileoverview Tests for use with the ESLint CSS plugin.
 *
 * The plugin doesn't hand the extension the syntax it's extending. It calls it
 * with just the CSS definition data and merges whatever comes back into the
 * default syntax, so the extension has to hold up without a complete `prev`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import fs from "node:fs/promises";
import { fork } from "@eslint/css-tree";
import definitionSyntaxData from "@eslint/css-tree/definition-syntax-data";
import { scss } from "../src/scss.js";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const fixtureFilename = "./tests/fixtures/scss.scss";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("ESLint CSS plugin compatibility", () => {
	let parse, generate, lexer;

	beforeEach(() => {
		// this is what @eslint/css does with a `customSyntax` function
		({ parse, generate, lexer } = fork(scss(definitionSyntaxData)));
	});

	it("should produce a syntax with no broken types", () => {
		assert.strictEqual(lexer.validate(), null);
	});

	it("should parse SCSS", () => {
		assert.strictEqual(
			generate(parse("$a: 1px; .b { width: $a; }")),
			"$a:1px;.b{width:$a}",
		);
	});

	it("should support single-line comments", () => {
		assert.strictEqual(
			generate(parse("// comment\n.a { color: red; }")),
			".a{color:red}",
		);
	});

	it("should parse interpolation in a var() custom property name", () => {
		assert.strictEqual(
			generate(
				parse(
					".a { border-color: var(--#{$prefix}form-invalid-border-color); }",
				),
			),
			".a{border-color:var(--#{$prefix}form-invalid-border-color)}",
		);
	});

	for (const [condition, expected] of [
		["@media (min-width: $w)", "@media (min-width:$w)"],
		["@supports (display: grid)", "@supports (display:grid)"],
		["@container (min-width: 10px)", "@container (min-width:10px)"],
	]) {
		it(`should preserve nested rules in ${condition} with definition data only`, () => {
			const code = `.parent { ${condition} { color: blue; .child { color: red; } } }`;
			const options = {
				onParseError(error) {
					throw error;
				},
			};
			const ast = parse(code, options);
			const output = generate(ast);

			assert.strictEqual(
				output,
				`.parent{${expected}{color:blue;.child{color:red}}}`,
			);
			assert.strictEqual(generate(parse(output, options)), output);
			assert.strictEqual(
				ast.children.first.block.children.first.block.children.last
					.type,
				"Rule",
			);
		});
	}

	it("should still parse a CSS @import", () => {
		assert.strictEqual(
			generate(parse('@import url("a.css") layer(base) screen;')),
			"@import url(a.css)layer(base) screen;",
		);
	});

	it("should parse the fixture without errors", async () => {
		const code = await fs.readFile(fixtureFilename, "utf8");
		const errors = [];

		parse(code, {
			filename: fixtureFilename,
			positions: true,
			onParseError(error) {
				errors.push(`${error.line}:${error.column} ${error.message}`);
			},
		});

		assert.deepStrictEqual(errors, []);
	});
});
