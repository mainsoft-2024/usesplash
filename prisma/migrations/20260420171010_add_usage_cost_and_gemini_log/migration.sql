-- AlterTable
ALTER TABLE "UsageLog" ADD COLUMN     "blobBytes" BIGINT,
ADD COLUMN     "blobCostUsd" DECIMAL(14,6),
ADD COLUMN     "imageCostUsd" DECIMAL(14,6),
ADD COLUMN     "imageCount" INTEGER,
ADD COLUMN     "llmCostUsd" DECIMAL(14,6),
ADD COLUMN     "llmInputTokens" INTEGER,
ADD COLUMN     "llmOutputTokens" INTEGER,
ADD COLUMN     "model" TEXT;

-- CreateTable
CREATE TABLE "GeminiRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpCode" INTEGER,
    "attempt" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeminiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeminiRequestLog_createdAt_idx" ON "GeminiRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "GeminiRequestLog_status_createdAt_idx" ON "GeminiRequestLog"("status", "createdAt");
