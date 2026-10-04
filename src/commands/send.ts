import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { confirm } from "../lib/confirm.js";
import {
  InvalidArgument,
  NETWORKS,
  SOLANA,
  checkFlags,
  isEvmAddress,
  isSolanaAddress,
  parseNetworkId,
} from "../lib/validate.js";

const USAGE = `moonrush-cli send <sub> [options]

  usdc    --to <address> --amount <n> [--networkId <id|name>] [--note <text>]
          Cash out Solana USDC. Same chain by default; any other chain BRIDGES.
  asset   --token <native|0x…> --amount <minor|max> --to <0x…> [--networkId <id|name>]
          Move an EVM asset out of the embedded wallet. Same chain, no bridge.

Both MOVE MONEY and cannot be recalled. Each shows the exact figures and asks on a
terminal; --yes is for a person typing on their own machine.

Destination chains for \`usdc\`: solana (default, plain SPL transfer), base, bnb,
robinhood (delivers USDG, there is no USDC there), soneium (USDC.e), arc.
Bridged withdrawals have a 5 USDC minimum.`;

/** The dollar each chain actually delivers, which is not USDC everywhere. */
const DOLLAR: Record<number, string> = {
  1399811149: "USDC",
  8453: "USDC",
  56: "USDC",
  4663: "USDG",
  1868: "USDC.e",
  5042: "USDC",
};

function parseAmount(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgument("--amount must be a positive number of USDC");
  }
  return n;
}

/**
 * Cash out, on Solana or bridged.
 *
 * ⚠️ THE ADDRESS SHAPE IS THE CHAIN'S, and getting it wrong is the one mistake here that
 * cannot be undone. The same string is a different destination on two networks, so this
 * checks the shape against the chosen chain before anything is sent and says which chain it
 * is checking against. The server checks again and is the authority; this exists so the
 * refusal arrives before the confirmation rather than after it.
 *
 * ⚠️ A CHECKSUM MISMATCH IS NOT REPAIRED, by the server or here. A mixed-case `0x` address
 * whose EIP-55 checksum does not match almost certainly has a mistyped character, and
 * "fixing" it would deliver real money to an address the user never approved. The server
 * answers `RECIPIENT_CHECKSUM_MISMATCH`; the right response is to ask for the address again.
 */
async function sendUsdc(flags: Record<string, string | true>): Promise<number> {
  checkFlags(flags, ["to", "amount", "networkId", "note", "yes"], USAGE);

  const to = typeof flags.to === "string" ? flags.to.trim() : "";
  if (!to) throw new InvalidArgument("--to <address> is required");

  const amount = parseAmount(flags.amount);
  const networkId = parseNetworkId(flags.networkId);
  const bridged = networkId !== SOLANA;

  if (!DOLLAR[networkId]) {
    throw new InvalidArgument(
      `${NETWORKS[networkId] ?? networkId} has no dollar configured. ` +
        `Withdrawable: ${Object.keys(DOLLAR)
          .map((id) => NETWORKS[Number(id)] ?? id)
          .join(", ")}`,
    );
  }

  const shapeOk = bridged ? isEvmAddress(to) : isSolanaAddress(to);
  if (!shapeOk) {
    throw new InvalidArgument(
      bridged
        ? `--to must be a 0x address on ${NETWORKS[networkId]}, not a Solana one. ` +
          `The same string means different things on different chains.`
        : "--to must be a Solana address. For another chain pass --networkId.",
    );
  }

  // Stated before the question, because 5 is the bridge's floor and a 4.99 refusal after a
  // confirmation reads as the tool losing the money.
  if (bridged && amount < 5) {
    throw new InvalidArgument(
      `Bridged withdrawals have a 5 USDC minimum. ${amount} is below it.`,
    );
  }

  const dollar = DOLLAR[networkId];
  await confirm(
    `Withdraw ${amount} USDC to ${NETWORKS[networkId]}` +
      `${bridged ? ` as ${dollar}` : ""}.\n` +
      `To: ${to}\n` +
      `Fee: 0.02 USDC on the Solana side` +
      `${bridged ? ", and the bridge takes its own cut out of what arrives" : ""}.\n` +
      `This sends from your wallet and cannot be recalled.`,
    flags,
  );

  const data = await api<unknown>("/transfer/usdc", {
    method: "POST",
    body: {
      recipientAddress: to,
      amount,
      // Omitted on Solana so the request is the plain SPL transfer it has always been,
      // rather than a bridge asked to deliver to the chain it started on.
      ...(bridged ? { destinationNetworkId: networkId } : {}),
      ...(typeof flags.note === "string" ? { note: flags.note } : {}),
    },
  });
  print(data, flags);
  return 0;
}

/**
 * Move an EVM asset out, previewing first.
 *
 * The preview is not decoration: it resolves `max` against the on-chain balance and answers
 * `valid: false` with a reason for a dead destination or an empty balance, which is a better
 * thing to show than a 400 after the user has already said yes.
 */
async function sendAsset(flags: Record<string, string | true>): Promise<number> {
  checkFlags(flags, ["token", "amount", "to", "networkId", "yes"], USAGE);

  const token = typeof flags.token === "string" ? flags.token.trim() : "";
  if (!token) {
    throw new InvalidArgument(
      '--token is required: "native" for the chain\'s coin, or a 0x token address',
    );
  }
  const to = typeof flags.to === "string" ? flags.to.trim() : "";
  if (!isEvmAddress(to)) {
    throw new InvalidArgument("--to must be a 0x address on the same chain");
  }
  const raw = typeof flags.amount === "string" ? flags.amount.trim() : "";
  if (raw !== "max" && !/^[1-9][0-9]*$/.test(raw)) {
    throw new InvalidArgument(
      '--amount must be raw MINOR units (an integer) or "max". ' +
        "Minor units, not dollars: a token with 6 decimals wants 1000000 for one unit.",
    );
  }
  const networkId = parseNetworkId(flags.networkId, 4663);
  if (networkId === SOLANA) {
    throw new InvalidArgument(
      "`send asset` is for EVM chains. For Solana USDC use `send usdc`.",
    );
  }

  const body = { token, amountMinor: raw, toAddress: to, networkId };

  const preview = await api<{
    valid?: boolean;
    reason?: string;
    symbol?: string;
    amountMinor?: string;
    needsGas?: boolean;
    hasGas?: boolean;
  }>("/rh/send/preview", { method: "POST", body });

  if (preview.valid === false) {
    process.stderr.write(
      `Cannot send: ${preview.reason ?? "the destination or the balance is not usable"}\n`,
    );
    return 1;
  }
  if (preview.needsGas && preview.hasGas === false) {
    process.stderr.write(
      "Cannot send: this chain charges the wallet for gas and it holds none.\n",
    );
    return 1;
  }

  const resolved = preview.amountMinor ?? raw;
  await confirm(
    `Send ${resolved} minor units of ${preview.symbol ?? token} on ` +
      `${NETWORKS[networkId] ?? networkId}.\n` +
      `To: ${to}\n` +
      `${raw === "max" ? "This is the whole balance the server read on chain.\n" : ""}` +
      `This sends from your wallet and cannot be recalled.`,
    flags,
  );

  const data = await api<unknown>("/rh/send", {
    method: "POST",
    body: {
      ...body,
      // A FRESH key per intentional send. Without one the server de-dupes on
      // token+amount+destination for 90 seconds, so somebody sending the same amount to the
      // same address twice on purpose gets DUPLICATE_TRADE for the second one.
      idempotencyKey: `send-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
  print(data, flags);
  return 0;
}

export async function runSend(
  sub: string | undefined,
  flags: Record<string, string | true>,
): Promise<number> {
  switch (sub) {
    case "usdc":
      return sendUsdc(flags);
    case "asset":
      return sendAsset(flags);
    default:
      process.stdout.write(`${USAGE}\n`);
      return sub ? 1 : 0;
  }
}
