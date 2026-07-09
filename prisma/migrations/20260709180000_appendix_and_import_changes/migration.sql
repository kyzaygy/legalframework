-- Тип структурной единицы «Приложение» (таблицы бюджетных законов и т.п.)
ALTER TYPE "UnitType" ADD VALUE 'APPENDIX';

-- Журнал изменений корпуса, заполняется импортёром
CREATE TYPE "ChangeKind" AS ENUM ('CODE_ADDED', 'CODE_UPDATED', 'ARTICLE_ADDED', 'ARTICLE_UPDATED', 'ARTICLE_REMOVED');

CREATE TABLE "ImportChange" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codeSlug" TEXT NOT NULL,
    "codeShort" TEXT NOT NULL,
    "kind" "ChangeKind" NOT NULL,
    "articleNumber" TEXT,
    "articleSlug" TEXT,
    "articleTitle" TEXT,
    "count" INTEGER,

    CONSTRAINT "ImportChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportChange_at_idx" ON "ImportChange"("at");
