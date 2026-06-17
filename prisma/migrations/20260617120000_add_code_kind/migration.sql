CREATE TYPE "CodeKind" AS ENUM ('CONSTITUTION', 'CODE', 'LAW');

ALTER TABLE "Code" ADD COLUMN "kind" "CodeKind" NOT NULL DEFAULT 'CODE';

UPDATE "Code" SET "kind" = 'CONSTITUTION' WHERE "slug" = 'konstituciya';
