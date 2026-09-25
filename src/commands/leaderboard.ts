import { api } from "../lib/api.js";
import { print } from "../index.js";
import { parseInteger } from "../lib/validate.js";

const USAGE = `moonrush-cli leaderboard <metric> [options]

  <metric>   pnl24h | pnl7d | pnl30d | pnlAll

  --rank                 Your own rank on that metric, instead of the list
  --around               The rows either side of you, instead of the top
  --page <n>             1-based (default 1). Not a cursor: this endpoint pages.
  --limit <n>            1 to 100 (default 50; 10 with --around)`;

const METRICS = ["pnl24h", "pnl7d", "pnl30d", "pnlAll"] as const;

export async function runLeaderboard(
  sub: string | undefined,
  flags: Record<string, string | true>,
): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    // `--help` was answered, so it succeeded. A bare command with no sub-command did not:
    // nothing was asked and nothing was returned, and a script must be able to tell those
    // apart by exit code alone.
    return flags.help ? 0 : 1;
  }
  // The metric is positional rather than a flag because there is no sensible default:
  // "the leaderboard" is four different leaderboards and the windows disagree about who is
  // winning. Making it positional forces the question to be answered.
  //
  // Checked here rather than with `parseChoice` so the message can say `metric` instead of
  // `--metric`, which is not a flag anybody can pass.
  const metric = METRICS.find((m) => m === sub);
  if (!metric) {
    process.stderr.write(
      `Unknown metric: ${sub}\nExpected one of: ${METRICS.join(", ")}\n`,
    );
    return 1;
  }

  if (flags.rank) {
    print(await api(`/leaderboard/${metric}/rank`), flags);
    return 0;
  }

  if (flags.around) {
    const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 10 });
    print(await api(`/leaderboard/${metric}/around?limit=${limit}`), flags);
    return 0;
  }

  // PAGE AND LIMIT, not a cursor. The discovery and position endpoints are cursor-paged
  // and this one is not; reaching for `--cursor` here gets it silently ignored.
  const page = parseInteger(flags.page, "page", { min: 1, max: 10_000, fallback: 1 });
  const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 50 });
  print(await api(`/leaderboard/${metric}?page=${page}&limit=${limit}`), flags);
  return 0;
}
