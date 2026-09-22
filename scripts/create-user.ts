// Create an account.
//
//   npm run user:add              -> prompts for a username and a password
//   npm run user:add -- keng      -> prompts for the password only
//
// The password is typed, never echoed, never passed as an argument (an argument
// would land in the shell history and in the process list) and never printed
// back. Only the hash is stored.
//
// Run against whatever DATABASE_URL the current shell resolves — which is the
// shared database, so an account made here works in every checkout, including
// the deploy.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../lib/prisma";
import { normalizeUsername } from "../lib/auth";
import { hashPassword } from "../lib/password";

/** Read a line with the terminal's echo turned off.
 *
 * Readline has no hidden-input mode, so this puts the tty into raw mode and
 * consumes keystrokes itself: backspace edits, Ctrl+C cancels, and nothing is
 * written back to the screen. Falls back to a visible prompt when stdin is not
 * a tty (piping a password in, e.g. in a script), because in that case there is
 * no one to hide it from. */
function promptHidden(question: string): Promise<string> {
  stdout.write(question);
  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      stdin.resume();
      stdin.once("data", (chunk) => {
        stdin.pause();
        resolve(chunk.toString("utf8").replace(/\r?\n$/, ""));
      });
    });
  }

  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    }

    function onData(chunk: string) {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          // Ctrl+C
          cleanup();
          stdout.write("\n");
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  const fromArgv = process.argv[2];
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const raw =
      fromArgv ?? (await rl.question("Username (letters, digits, - and _): ")).trim();
    const username = normalizeUsername(raw);
    if (!username) {
      throw new Error(
        `"${raw}" is not a usable username — 2 to 32 characters, starting with a letter or digit, using only letters, digits, "-" and "_".`
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new Error(`Account "${username}" already exists.`);

    const password = await promptHidden(`Password for ${username}: `);
    if (password.length < 8) throw new Error("Use at least 8 characters.");

    const confirm = await promptHidden("Confirm password: ");
    if (password !== confirm) throw new Error("The passwords didn't match.");

    await prisma.user.create({ data: { username, passwordHash: hashPassword(password) } });

    stdout.write(
      `\nCreated account "${username}". Sign in at /login with that username and password.\n` +
        `(Every account sees the same dashboard; the account is what records when you last looked.)\n`
    );
  } finally {
    rl.close();
  }
}

main()
  .catch((error: unknown) => {
    stdout.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
