import { describe, expect, test, afterEach } from "bun:test";
import { Refused, confirm } from "./confirm";

const realIsTTY = process.stdin.isTTY;
afterEach(() => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: realIsTTY,
    configurable: true,
  });
});

function setTTY(value: boolean) {
  Object.defineProperty(process.stdin, "isTTY", { value, configurable: true });
}

describe("the gate in front of the money", () => {
  test("no terminal means NO, not yes", async () => {
    // THE WHOLE POINT. Piped, scripted or driven by an agent there is nobody to ask, and
    // the safe reading of silence is "this was not authorised". Defaulting to yes when the
    // answer cannot be collected would make the gate decorative in exactly the situation it
    // was built for.
    setTTY(false);
    await expect(confirm("Send $12.40?", {})).rejects.toBeInstanceOf(Refused);
  });

  test("the refusal tells an agent what to do instead, and it is not --yes", async () => {
    setTTY(false);
    try {
      await confirm("Send $12.40?", {});
      throw new Error("should have thrown");
    } catch (e) {
      const message = String((e as Error).message);
      expect(message).toContain("Send $12.40?");
      expect(message).toContain("must not add --yes");
    }
  });

  test("--yes passes without a terminal, which is the documented escape hatch", async () => {
    // For a person in a script who has already decided. The skills say an agent must never
    // pass it; that instruction is worth writing and is not worth trusting, which is why
    // the test above is the real mechanism and this one is the exception.
    setTTY(false);
    await confirm("Send $12.40?", { yes: true });
    await confirm("Send $12.40?", { yes: "true" });
  });

  test("a value that merely looks truthy is not --yes", async () => {
    // `--yes` with a following word parses as `{ yes: "<word>" }`, so accepting any
    // truthy string would turn `moonrush-cli rewards claim --yes maybe` into a payment.
    setTTY(false);
    await expect(confirm("Send $12.40?", { yes: "no" })).rejects.toBeInstanceOf(Refused);
    await expect(confirm("Send $12.40?", { yes: "1" })).rejects.toBeInstanceOf(Refused);
  });
});
