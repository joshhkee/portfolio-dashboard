-- Accounts become approvable: a request is a row whose "approvedAt" is NULL.
--
-- The backfill is the important half. Every row that already exists was created
-- deliberately — by hand in SQL, or by `npm run user:add` — so none of them is a
-- pending request, and leaving them NULL would lock out everyone who currently
-- has an account. Setting it from "createdAt" says exactly that: this account
-- was let in when it was made.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "User" SET "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;

-- `josh` becomes the admin, because an approval queue with nobody able to
-- approve it is a dead end. Guarded so it is a no-op on a database where that
-- username does not exist (a fresh clone, or a rename).
UPDATE "User" SET "role" = 'admin' WHERE "username" = 'josh' AND "approvedAt" IS NOT NULL;
