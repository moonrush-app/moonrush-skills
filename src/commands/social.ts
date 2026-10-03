import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { confirm } from "../lib/confirm.js";
import { sanitizeSocial } from "../lib/sanitize.js";
import {
  InvalidArgument,
  checkFlags,
  parseInteger,
  parseNetworkIdList,
  requireUuid,
} from "../lib/validate.js";

/**
 * The social side of Moonrush: the feed, mooncalls, and who follows whom.
 *
 * Everything people wrote comes back through `sanitizeSocial` before it is printed. A
 * mooncall is free text from a stranger, and it lands in an agent's context exactly like a
 * token description does.
 */

type Flags = Record<string, string | true>;

/** A username or a user id to the id the API takes. `@` is optional. */
async function resolveUser(flags: Flags): Promise<string> {
  if (typeof flags.userId === "string") return requireUuid(flags.userId, "userId");
  if (typeof flags.username !== "string" || !flags.username.trim()) {
    throw new InvalidArgument("Give --username <name> or --userId <uuid>");
  }
  const name = flags.username.trim().replace(/^@/, "");
  const user = await api<{ userId?: string; user?: { userId?: string } }>(
    `/users/by-username/${encodeURIComponent(name)}`,
  );
  const id = user.userId ?? user.user?.userId;
  if (!id) throw new InvalidArgument(`No Moonrush user called @${name}`);
  return id;
}

function feedQuery(flags: Flags): string {
  const q = new URLSearchParams();
  q.set("limit", String(parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 20 })));
  if (typeof flags.cursor === "string") q.set("cursor", flags.cursor);
  const networks = parseNetworkIdList(flags.networkId);
  if (networks) q.set("networkIds", networks);
  if (typeof flags.kinds === "string") {
    const kinds = flags.kinds.split(",").map((k) => k.trim()).filter(Boolean);
    const bad = kinds.filter((k) => !["comment", "repost", "trade"].includes(k));
    if (bad.length) throw new InvalidArgument(`--kinds takes comment, repost, trade. Not: ${bad.join(", ")}`);
    q.set("kinds", kinds.join(","));
  }
  return q.toString();
}

const FEED_USAGE = `moonrush-cli feed <sub> [options]

  posts     The feed: mooncalls, reposts and trades, newest first
  user      One person's posts: --username <name> | --userId <uuid>

  --following            posts only: just the people you follow
  --kinds <csv>          comment, repost, trade (default all three)
  --networkId <csv>      chains, by id or name
  --limit <n>            1 to 50 (default 20)
  --cursor <c>           the nextCursor of the previous page`;

export async function runFeed(sub: string | undefined, flags: Flags): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(FEED_USAGE + "\n");
    return flags.help ? 0 : 1;
  }
  const common = ["kinds", "networkId", "limit", "cursor"];
  const ALLOWED: Record<string, readonly string[]> = {
    posts: [...common, "following"],
    user: [...common, "username", "userId"],
  };
  if (!ALLOWED[sub]) {
    process.stderr.write(`Unknown sub-command: ${sub}\n\n${FEED_USAGE}\n`);
    return 1;
  }
  checkFlags(flags, ALLOWED[sub]!, `feed ${sub}`);

  if (sub === "posts") {
    const path = flags.following ? "/feeds/posts/following" : "/feeds/posts";
    print(sanitizeSocial(await api(`${path}?${feedQuery(flags)}`)), flags);
    return 0;
  }
  const userId = await resolveUser(flags);
  print(sanitizeSocial(await api(`/feeds/posts/user/${userId}?${feedQuery(flags)}`)), flags);
  return 0;
}

const MOONCALL_USAGE = `moonrush-cli mooncall <sub> [options]

  read      The thread on a position: --positionId <uuid>
  post      Write on a position: --positionId <uuid> --text "<words>". PUBLISHES.
            --parentId <uuid> to reply to a comment instead of posting at the top

  --limit <n>   read: 1 to 50 (default 20)    --cursor <c>   read: the next page

A position's id is the \`id\` in \`positions me\`, \`positions list\` or a feed item.
On your own position a top-level post IS your mooncall; on someone else's it is a reply.
post shows the text and asks on a terminal before publishing.`;

export async function runMooncall(sub: string | undefined, flags: Flags): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(MOONCALL_USAGE + "\n");
    return flags.help ? 0 : 1;
  }
  const ALLOWED: Record<string, readonly string[]> = {
    read: ["positionId", "limit", "cursor"],
    post: ["positionId", "text", "parentId", "yes"],
  };
  if (!ALLOWED[sub]) {
    process.stderr.write(`Unknown sub-command: ${sub}\n\n${MOONCALL_USAGE}\n`);
    return 1;
  }
  checkFlags(flags, ALLOWED[sub]!, `mooncall ${sub}`);
  const positionId = requireUuid(flags.positionId, "positionId");

  if (sub === "read") {
    const q = new URLSearchParams();
    q.set("limit", String(parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 20 })));
    if (typeof flags.cursor === "string") q.set("cursor", flags.cursor);
    print(sanitizeSocial(await api(`/positions/${positionId}/comments?${q}`)), flags);
    return 0;
  }

  const text = typeof flags.text === "string" ? flags.text.trim() : "";
  if (!text) throw new InvalidArgument('post needs --text "<words>"');
  if (text.length > 2000) throw new InvalidArgument("--text is at most 2000 characters");
  const parentId = flags.parentId === undefined ? undefined : requireUuid(flags.parentId, "parentId");

  // PUBLISHING IS NOT A READ. It goes out under the user's name to everyone who follows the
  // position, so it goes through the same gate as a trade: the exact text, then a person.
  await confirm(
    `Publish this ${parentId ? "reply" : "post"} on position ${positionId} under your name?\n\n` +
      `  ${text}\n\nEveryone who can see the position will see it.`,
    flags,
    "this publishes under your name",
  );
  print(
    sanitizeSocial(
      await api(`/positions/${positionId}/comments`, {
        method: "POST",
        body: { body: text, ...(parentId ? { parentId } : {}) },
      }),
    ),
    flags,
  );
  return 0;
}

const FOLLOW_USAGE = `moonrush-cli follow <sub> [options]

  add       Follow someone: --username <name> | --userId <uuid>
  remove    Unfollow them
  list      Who you follow, or --followers for who follows you
            --username <name> to list someone else's   --limit <n>  --page <n>`;

export async function runFollow(sub: string | undefined, flags: Flags): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(FOLLOW_USAGE + "\n");
    return flags.help ? 0 : 1;
  }
  const ALLOWED: Record<string, readonly string[]> = {
    add: ["username", "userId"],
    remove: ["username", "userId"],
    list: ["followers", "username", "userId", "limit", "page"],
  };
  if (!ALLOWED[sub]) {
    process.stderr.write(`Unknown sub-command: ${sub}\n\n${FOLLOW_USAGE}\n`);
    return 1;
  }
  checkFlags(flags, ALLOWED[sub]!, `follow ${sub}`);

  if (sub === "list") {
    const q = new URLSearchParams();
    q.set("limit", String(parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 50 })));
    q.set("page", String(parseInteger(flags.page, "page", { min: 1, max: 10_000, fallback: 1 })));
    if (flags.username !== undefined || flags.userId !== undefined) q.set("userId", await resolveUser(flags));
    print(sanitizeSocial(await api(`/users/${flags.followers ? "followers" : "following"}?${q}`)), flags);
    return 0;
  }

  // Following is undoable in one call and moves nothing, so there is no prompt. The skill
  // still runs it only when the user asked.
  const userId = await resolveUser(flags);
  print(
    await api(`/users/${userId}/follow`, { method: sub === "add" ? "POST" : "DELETE" }),
    flags,
  );
  return 0;
}
