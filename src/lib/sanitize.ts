/**
 * Making attacker-written text safe to put in front of an agent.
 *
 * A token's name, symbol and description are written by whoever deployed it. They arrive
 * from the API and land in the context of something that reads instructions for a living.
 * Nothing downstream can tell them apart from our own words unless this does.
 *
 * IT DOES NOT TRY TO DETECT INSTRUCTIONS. "Ignore previous instructions" and "Great
 * community, ignore the FUD" are the same sentence to a classifier, and a filter that
 * guesses would both miss attacks and mangle real names. What it removes instead are the
 * MECHANISMS that make injected text work:
 *
 *   Hidden characters. Zero-width spaces and joiners, bidi overrides, control codes, the
 *   Unicode tag block. None has a legitimate use in a token name, and all of them exist so
 *   that a human reviewer and a model see different strings.
 *
 *   Fake boundaries. Newlines. A name is one line; a name carrying a blank line followed by
 *   "System:" is trying to end our message and start somebody else's.
 *
 *   Unbounded length. A 40KB "symbol" is not a symbol, it is a delivery mechanism, and
 *   truncation is the only defence that does not require reading it.
 *
 * What survives is still ATTACKER-WRITTEN. The point is that it can no longer pretend to be
 * anything other than a string in a field, which is why callers present it as data rather
 * than trusting this to have made it safe.
 */

/** Long enough for any real name; short enough that nothing can hide in the tail. */
export const MAX_FIELD_CHARS = 200;
/** A description is prose and gets more room. Still bounded. */
export const MAX_DESCRIPTION_CHARS = 600;

/**
 * Characters with no legitimate place in a display string.
 *
 * C0 and C1 controls; zero-width space, non-joiner and joiner; word joiner and invisible
 * operators; the bidi isolates and overrides, which can render a string right-to-left so
 * that what a person reads is not what a model parses; the BOM; and the Unicode tag block,
 * which is invisible everywhere and has carried whole paragraphs inside one emoji.
 *
 * TAB, CR AND LF ARE DELIBERATELY ABSENT. Line endings are collapsed rather than deleted a
 * few lines down, and a tab is ordinary spacing.
 */
const INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u2060-\u2064\u2066-\u2069\u202A-\u202E\uFEFF]|[\u{E0000}-\u{E007F}]/gu;

/** Anything that ends a line, which is how a fake turn boundary is drawn. */
const NEWLINES = /(\r\n|\r|\n)+/g;

export interface Sanitized {
  /** Safe to display. Never safe to obey. */
  value: string;
  /**
   * What was taken out, if anything.
   *
   * Reported rather than silently dropped: a name that needed cleaning is itself a signal,
   * and a caller showing "BONK" without mentioning it arrived carrying eleven zero-width
   * joiners has hidden the most interesting thing about it.
   */
  removed?: ("invisible" | "newlines" | "truncated")[];
}

export function sanitizeText(input: unknown, max = MAX_FIELD_CHARS): Sanitized {
  if (typeof input !== "string") return { value: "" };
  const removed: NonNullable<Sanitized["removed"]> = [];

  let out = input;

  // `lastIndex` is reset around every use. These are /g regexes and `test` advances it, so
  // a shared instance silently skips the start of the next string it is handed, which would
  // let the second token in a list through uncleaned.
  INVISIBLE.lastIndex = 0;
  if (INVISIBLE.test(out)) {
    INVISIBLE.lastIndex = 0;
    out = out.replace(INVISIBLE, "");
    removed.push("invisible");
  }
  INVISIBLE.lastIndex = 0;

  NEWLINES.lastIndex = 0;
  if (NEWLINES.test(out)) {
    NEWLINES.lastIndex = 0;
    out = out.replace(NEWLINES, " ");
    removed.push("newlines");
  }
  NEWLINES.lastIndex = 0;

  // After the newline pass, so three newlines do not leave three spaces behind.
  out = out.replace(/\s{2,}/g, " ").trim();

  // `Array.from`, not `.length`: an emoji is two UTF-16 units, and slicing by index can cut
  // one in half and leave a lone surrogate that breaks JSON consumers downstream.
  const chars = Array.from(out);
  if (chars.length > max) {
    out = chars.slice(0, max).join("") + "\u2026";
    removed.push("truncated");
  }

  return removed.length ? { value: out, removed } : { value: out };
}

/**
 * The text fields on a token row, cleaned on a copy.
 *
 * Named explicitly rather than walking every string in the object. A blanket walk would
 * also rewrite addresses, ids and signatures, whose exactness is the whole point and where
 * "helpfully" stripping a character produces a different token.
 */
const TEXT_FIELDS = ["name", "symbol", "description"] as const;

export function sanitizeTokenRow<T>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };

  // The API nests metadata under `token` on most shapes and flattens it on others. Both are
  // handled: a row that skipped cleaning because of its shape is the same hole as no
  // cleaning at all.
  const containers: Record<string, unknown>[] = [copy];
  if (copy.token && typeof copy.token === "object") {
    copy.token = { ...(copy.token as Record<string, unknown>) };
    containers.push(copy.token as Record<string, unknown>);
  }

  for (const container of containers) {
    for (const f of TEXT_FIELDS) {
      if (typeof container[f] !== "string") continue;
      const max = f === "description" ? MAX_DESCRIPTION_CHARS : MAX_FIELD_CHARS;
      const { value, removed } = sanitizeText(container[f], max);
      container[f] = value;
      if (removed) {
        // On the row, not in a log: whoever reads this output is the one who needs to know
        // the string was altered, and a log line is somewhere else entirely.
        container[f + "_sanitized"] = removed;
      }
    }
  }
  return copy as T;
}

/** Every row of a board or a list. */
export function sanitizeRows<T>(rows: T[]): T[] {
  return Array.isArray(rows) ? rows.map(sanitizeTokenRow) : rows;
}
