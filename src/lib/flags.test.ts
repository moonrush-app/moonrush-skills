import { describe, expect, test } from "bun:test";
import { InvalidArgument, checkFlags } from "./validate";
import { parseArgs } from "./args";

describe("an unknown flag is refused, not ignored", () => {
  test("--chain instead of --networkId", () => {
    // THE BUG THIS PINS. `token verified --chain 1868` used to ask for Soneium, be served
    // Solana, and exit 0 with 118 rows. Nothing said the flag had been dropped, so the
    // only available reading was that Soneium's roster looks like that.
    expect(() => checkFlags({ chain: "1868" }, ["networkId"], "token verified")).toThrow(
      InvalidArgument,
    );
    try {
      checkFlags({ chain: "1868" }, ["networkId"], "token verified");
    } catch (e) {
      const m = String((e as Error).message);
      expect(m).toContain("--chain is not a flag");
      // The valid set is printed, because "not a flag" alone leaves the reader guessing.
      expect(m).toContain("--networkId");
    }
  });

  test("wrong case gets a certain suggestion, not a guess", () => {
    // --sortby for --sortBy is the most common miss, and it is not a near-match to be
    // ranked: ignoring case it is the same word, so the suggestion is a fact.
    try {
      checkFlags({ sortby: "x" }, ["sortBy", "limit"], "positions top");
      throw new Error("should have thrown");
    } catch (e) {
      expect(String((e as Error).message)).toContain("Did you mean --sortBy?");
    }
  });

  test("a near miss is suggested, a far one is not", () => {
    const near = (() => {
      try { checkFlags({ limt: "5" }, ["limit"], "x"); } catch (e) { return String((e as Error).message); }
    })();
    expect(near).toContain("Did you mean --limit?");

    const far = (() => {
      try { checkFlags({ hoantoanbia: "x" }, ["limit"], "x"); } catch (e) { return String((e as Error).message); }
    })();
    // No suggestion invented for something that resembles nothing. A wrong suggestion is
    // worse than none: it sends the reader to try a flag that will not help either.
    expect(far).not.toContain("Did you mean");
  });

  test("--raw and --help pass everywhere without being listed", () => {
    expect(() => checkFlags({ raw: true, help: true }, [], "anything")).not.toThrow();
  });

  test("a flag valid on another sub-command is still refused here", () => {
    // `token info --q pengu` is as wrong as an invented flag, and a command-wide allowlist
    // would have waved it through.
    expect(() => checkFlags({ q: "pengu" }, ["address", "networkId"], "token info")).toThrow(
      InvalidArgument,
    );
  });
});

describe("parseArgs keeps positionals apart from flag values", () => {
  test("a flag's value is not mistaken for the sub-command", () => {
    // `token --networkId 1868 verified` answered "Unknown sub-command: 1868", because the
    // old rule was "first argument not starting with --" and 1868 is a VALUE. Only the
    // parser knows which words it consumed.
    const { flags, positionals } = parseArgs(["--networkId", "1868", "verified"]);
    expect(positionals).toEqual(["verified"]);
    expect(flags.networkId).toBe("1868");
  });

  test("the ordinary order still works", () => {
    const { flags, positionals } = parseArgs(["verified", "--networkId", "1868"]);
    expect(positionals).toEqual(["verified"]);
    expect(flags.networkId).toBe("1868");
  });

  test("--flag=value, and a bare flag before a positional", () => {
    const { flags, positionals } = parseArgs(["--raw", "me", "--limit=50"]);
    expect(flags.raw).toBe(true);
    expect(flags.limit).toBe("50");
    expect(positionals).toEqual(["me"]);
  });
});
