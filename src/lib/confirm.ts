import { createInterface } from "node:readline";

/**
 * The gate in front of the one command that moves money.
 *
 * WHY A CLI NEEDS THIS AT ALL. Most of this tool is read-only, and a wrong read costs a
 * wasted request. `rewards claim` is different: it broadcasts a transfer, and a broadcast
 * transfer cannot be recalled. What makes that worth a gate rather than a warning is WHO
 * runs these commands. These skills exist so an agent can run them, and an agent that has
 * decided to be helpful will run the command it was reading about.
 *
 * So the default is to refuse. There are exactly two ways through:
 *
 *   - a person answering a prompt on a terminal, or
 *   - `--yes`, which only a person should ever type.
 *
 * The skill files say `--yes` is never for the agent to pass on its own. That instruction
 * is worth writing and is not worth trusting, which is why the prompt below is the real
 * mechanism and `--yes` is the documented exception.
 */

export class Refused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Refused";
  }
}

/**
 * Ask, and treat anything other than a clear yes as a no.
 *
 * NOT A TTY MEANS NO. Piped or run by an agent there is nobody to ask, and the safe
 * reading of silence is "this was not authorised". Defaulting to yes when the answer
 * cannot be collected would make the gate decorative in precisely the situation it was
 * built for.
 */
export async function confirm(
  question: string,
  flags: Record<string, unknown>,
): Promise<void> {
  if (flags.yes === true || flags.yes === "true") return;

  if (!process.stdin.isTTY) {
    throw new Refused(
      `${question}\n\n` +
        "Refused: this moves money and there is no terminal here to confirm on.\n" +
        "A person can re-run it with --yes.\n" +
        "An agent must ask its user first, and must not add --yes on its own.",
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise<string>((resolve) => {
    // Written to stderr, not stdout. Every command here prints JSON on stdout and a
    // prompt mixed into it would break the pipe this tool is meant to sit in.
    rl.question(`${question}\nType yes to continue: `, (a) => {
      rl.close();
      resolve(a);
    });
  });

  if (answer.trim().toLowerCase() !== "yes") {
    throw new Refused("Cancelled. Nothing was sent.");
  }
}
