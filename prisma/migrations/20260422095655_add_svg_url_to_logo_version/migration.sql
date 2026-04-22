-- AlterTable
ALTER TABLE "LogoVersion" ADD COLUMN     "svgUrl" TEXT;

-- CreateTable
CREATE TABLE "RecraftRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "logoId" TEXT,
    "versionId" TEXT,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpCode" INTEGER,
    "attempt" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecraftRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecraftRequestLog_createdAt_idx" ON "RecraftRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RecraftRequestLog_status_createdAt_idx" ON "RecraftRequestLog"("status", "createdAt");
