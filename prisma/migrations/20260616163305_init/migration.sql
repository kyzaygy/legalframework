-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('PART', 'SECTION', 'CHAPTER', 'PARAGRAPH');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('ACTIVE', 'REPEALED', 'FUTURE');

-- CreateTable
CREATE TABLE "Code" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "editionDate" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructuralUnit" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "UnitType" NOT NULL,
    "number" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "StructuralUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "unitId" TEXT,
    "number" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'ACTIVE',
    "editionDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Code_slug_key" ON "Code"("slug");

-- CreateIndex
CREATE INDEX "StructuralUnit_codeId_idx" ON "StructuralUnit"("codeId");

-- CreateIndex
CREATE INDEX "StructuralUnit_parentId_idx" ON "StructuralUnit"("parentId");

-- CreateIndex
CREATE INDEX "Article_codeId_idx" ON "Article"("codeId");

-- CreateIndex
CREATE INDEX "Article_unitId_idx" ON "Article"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_codeId_slug_key" ON "Article"("codeId", "slug");

-- AddForeignKey
ALTER TABLE "StructuralUnit" ADD CONSTRAINT "StructuralUnit_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "Code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuralUnit" ADD CONSTRAINT "StructuralUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StructuralUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "Code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "StructuralUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
