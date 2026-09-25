/**
 * Argument parsing and output, kept out of the entry point.
 *
 * index.ts runs `main()` at import time, which is what an executable should do and what
 * makes it unimportable: a test that pulled `parseArgs` out of it ran the whole CLI as a
 * side effect and printed the usage screen into the test output. Commands were importing
 * `print` from it too, so every one of them depended on the file that depends on them.
 */

/**
 * `--flag value` and `--flag=value`, plus bare `--flag` as true.
 *
 * Returns the positionals SEPARATELY, and that separation is the point. Picking the
 * sub-command with "first argument not starting with --" looked equivalent and is not: in
 * `token --networkId 1868 verified` the 1868 is a flag's VALUE, and that rule reads it as
 * the sub-command and answers "Unknown sub-command: 1868". Only the parser knows which
 * words it already consumed.
 */
/**
 * Flags that are on/off and therefore never eat the next word.
 *
 * `--flag value` syntax cannot tell `--raw me` apart from `--limit 50` without knowing
 * which flags take a value. Without this list `positions --raw me` parses as
 * `{raw: "me"}` with no sub-command at all, and the CLI answers with its usage screen for
 * a command that was perfectly well formed.
 *
 * Declared here rather than per command because the parser runs before any command is
 * chosen. The cost of the list being wrong is one flag misparsing, which a test catches;
 * the cost of not having it is a whole command shape being unusable.
 */
const BOOLEAN_FLAGS = new Set([
  "raw",
  "help",
  "refresh",
  "rank",
  "around",
  "yes",
  "check",
]);

export function parseArgs(argv: string[]): {
  flags: Record<string, string | true>;
  positionals: string[];
} {
  const flags: Record<string, string | true> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (!a.startsWith("--")) {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (!BOOLEAN_FLAGS.has(name) && next && !next.startsWith("--")) {
      flags[name] = next;
      i++;
    } else {
      flags[name] = true;
    }
  }
  return { flags, positionals };
}

/** JSON, always. `--raw` puts it on one line for a pipe. */
export function print(value: unknown, flags: Record<string, unknown>): void {
  process.stdout.write(
    (flags.raw ? JSON.stringify(value) : JSON.stringify(value, null, 2)) + "\n",
  );
}
