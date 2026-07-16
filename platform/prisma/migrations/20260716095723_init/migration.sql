-- CreateEnum
CREATE TYPE "CompanyUserRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "QuestionPhase" AS ENUM ('PROBLEM', 'EXPERIENCE', 'RESULT', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "CaptureSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COLLECTED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VideoAssetStatus" AS ENUM ('UPLOADING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "RewardCodeType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "RewardCodeStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SetupFeeStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "stripeCustomerId" TEXT,
    "setupFeePaidAt" TIMESTAMP(3),
    "rewardType" "RewardCodeType" DEFAULT 'PERCENTAGE',
    "rewardValue" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CompanyUserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phase" "QuestionPhase" NOT NULL,
    "promptText" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "minDurationSeconds" INTEGER NOT NULL DEFAULT 8,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientName" TEXT,
    "status" "CaptureSessionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "captureSessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'DRAFT',
    "synthesisText" TEXT,
    "consentGivenAt" TIMESTAMP(3),
    "consentIp" TEXT,
    "consentTextVersion" INTEGER,
    "archivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial_answers" (
    "id" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "transcriptText" TEXT,
    "durationSeconds" INTEGER,
    "qualityCheckPassed" BOOLEAN NOT NULL DEFAULT false,
    "retakeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonial_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL,
    "testimonialAnswerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cloudflare_stream',
    "externalUid" TEXT NOT NULL,
    "playbackId" TEXT,
    "status" "VideoAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "durationSeconds" INTEGER,
    "watermarkApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_codes" (
    "id" TEXT NOT NULL,
    "captureSessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "RewardCodeType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "status" "RewardCodeStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "reward_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "stripeUsageEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "minVolume" INTEGER NOT NULL,
    "maxVolume" INTEGER,
    "unitPriceCents" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "setupFeeStatus" "SetupFeeStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_stripeCustomerId_key" ON "companies"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "company_users_clerkUserId_key" ON "company_users"("clerkUserId");

-- CreateIndex
CREATE INDEX "company_users_companyId_idx" ON "company_users"("companyId");

-- CreateIndex
CREATE INDEX "questions_companyId_active_idx" ON "questions"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "capture_sessions_token_key" ON "capture_sessions"("token");

-- CreateIndex
CREATE INDEX "capture_sessions_companyId_idx" ON "capture_sessions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "testimonials_captureSessionId_key" ON "testimonials"("captureSessionId");

-- CreateIndex
CREATE INDEX "testimonials_companyId_status_idx" ON "testimonials"("companyId", "status");

-- CreateIndex
CREATE INDEX "testimonial_answers_testimonialId_idx" ON "testimonial_answers"("testimonialId");

-- CreateIndex
CREATE UNIQUE INDEX "testimonial_answers_testimonialId_questionId_key" ON "testimonial_answers"("testimonialId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_testimonialAnswerId_key" ON "video_assets"("testimonialAnswerId");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_externalUid_key" ON "video_assets"("externalUid");

-- CreateIndex
CREATE UNIQUE INDEX "reward_codes_captureSessionId_key" ON "reward_codes"("captureSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_codes_code_key" ON "reward_codes"("code");

-- CreateIndex
CREATE INDEX "reward_codes_companyId_idx" ON "reward_codes"("companyId");

-- CreateIndex
CREATE INDEX "downloads_companyId_billingMonth_idx" ON "downloads"("companyId", "billingMonth");

-- CreateIndex
CREATE INDEX "pricing_tiers_companyId_idx" ON "pricing_tiers"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_companyId_key" ON "billing_accounts"("companyId");

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "capture_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial_answers" ADD CONSTRAINT "testimonial_answers_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "testimonials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial_answers" ADD CONSTRAINT "testimonial_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_testimonialAnswerId_fkey" FOREIGN KEY ("testimonialAnswerId") REFERENCES "testimonial_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_codes" ADD CONSTRAINT "reward_codes_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "capture_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "testimonials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "company_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
