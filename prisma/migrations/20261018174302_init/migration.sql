-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HOMEOWNER', 'BUILDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Package" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'LUXURY');

-- CreateEnum
CREATE TYPE "Facing" AS ENUM ('NORTH', 'EAST', 'SOUTH', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'OPEN', 'UNDER_REVIEW', 'AWARDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'REJECTED', 'AWARDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DemoType" AS ENUM ('PORTFOLIO', 'DESIGN_LINK', 'VIDEO', 'IMAGES');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROJECT_PUBLISHED', 'BID_RECEIVED', 'BID_UPDATED', 'BID_WITHDRAWN', 'BID_SHORTLISTED', 'BID_REJECTED', 'BID_AWARDED', 'PROJECT_AWARDED', 'PROJECT_CANCELLED', 'BIDDING_CLOSED', 'NEW_MESSAGE', 'BUILDER_VERIFIED', 'BUILDER_REJECTED', 'REVIEW_RECEIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "citiesServed" TEXT[],
    "gstNumber" TEXT,
    "licenseDocUrl" TEXT,
    "about" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "completedProjectsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "areaSqft" INTEGER NOT NULL,
    "imageUrls" TEXT[],
    "description" TEXT,
    "completedYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "homeownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "plotLengthFt" INTEGER NOT NULL,
    "plotWidthFt" INTEGER NOT NULL,
    "plotAreaSqft" INTEGER NOT NULL,
    "builtUpAreaSqft" INTEGER NOT NULL,
    "floors" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "parking" BOOLEAN NOT NULL DEFAULT false,
    "facing" "Facing" NOT NULL,
    "vastuRequired" BOOLEAN NOT NULL DEFAULT false,
    "preferredPackage" "Package" NOT NULL,
    "extraBasement" BOOLEAN NOT NULL DEFAULT false,
    "extraLift" BOOLEAN NOT NULL DEFAULT false,
    "extraCompoundWall" BOOLEAN NOT NULL DEFAULT false,
    "extraSump" BOOLEAN NOT NULL DEFAULT false,
    "extraSolar" BOOLEAN NOT NULL DEFAULT false,
    "budgetMin" INTEGER NOT NULL,
    "budgetMax" INTEGER NOT NULL,
    "startTimeline" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "bidDeadline" TIMESTAMP(3),
    "awardedBidId" TEXT,
    "awardedAt" TIMESTAMP(3),
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "package" "Package" NOT NULL,
    "ratePerSqftLow" INTEGER NOT NULL,
    "ratePerSqftHigh" INTEGER NOT NULL,
    "totalLow" INTEGER NOT NULL,
    "totalHigh" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "recommendedPlan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "timelineWeeks" INTEGER NOT NULL,
    "materialsSpec" JSONB NOT NULL,
    "warrantyYears" INTEGER NOT NULL,
    "paymentMilestones" JSONB NOT NULL,
    "demoType" "DemoType" NOT NULL,
    "demoUrls" TEXT[],
    "demoPortfolioItemIds" TEXT[],
    "coverNote" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidRevision" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "timelineWeeks" INTEGER NOT NULL,
    "materialsSpec" JSONB NOT NULL,
    "warrantyYears" INTEGER NOT NULL,
    "paymentMilestones" JSONB NOT NULL,
    "demoType" "DemoType" NOT NULL,
    "demoUrls" TEXT[],
    "coverNote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "homeownerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimatorRate" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "package" "Package" NOT NULL,
    "ratePerSqftLow" INTEGER NOT NULL,
    "ratePerSqftHigh" INTEGER NOT NULL,
    "breakdownPercents" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimatorRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderProfile_userId_key" ON "BuilderProfile"("userId");

-- CreateIndex
CREATE INDEX "BuilderProfile_verificationStatus_idx" ON "BuilderProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "PortfolioItem_builderId_idx" ON "PortfolioItem"("builderId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_awardedBidId_key" ON "Project"("awardedBidId");

-- CreateIndex
CREATE INDEX "Project_homeownerId_idx" ON "Project"("homeownerId");

-- CreateIndex
CREATE INDEX "Project_status_bidDeadline_idx" ON "Project"("status", "bidDeadline");

-- CreateIndex
CREATE INDEX "Project_city_status_idx" ON "Project"("city", "status");

-- CreateIndex
CREATE INDEX "Estimate_projectId_createdAt_idx" ON "Estimate"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_builderId_status_idx" ON "Bid"("builderId", "status");

-- CreateIndex
CREATE INDEX "Bid_projectId_status_idx" ON "Bid"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_projectId_builderId_key" ON "Bid"("projectId", "builderId");

-- CreateIndex
CREATE UNIQUE INDEX "BidRevision_bidId_revisionNumber_key" ON "BidRevision"("bidId", "revisionNumber");

-- CreateIndex
CREATE INDEX "Message_bidId_createdAt_idx" ON "Message"("bidId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_projectId_key" ON "Review"("projectId");

-- CreateIndex
CREATE INDEX "Review_builderId_idx" ON "Review"("builderId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimatorRate_city_package_key" ON "EstimatorRate"("city", "package");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "BuilderProfile" ADD CONSTRAINT "BuilderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "BuilderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_homeownerId_fkey" FOREIGN KEY ("homeownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_awardedBidId_fkey" FOREIGN KEY ("awardedBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "BuilderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRevision" ADD CONSTRAINT "BidRevision_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "BuilderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_homeownerId_fkey" FOREIGN KEY ("homeownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
