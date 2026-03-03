-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "annualRevenue" INTEGER,
ADD COLUMN     "foundedAt" TIMESTAMP(3),
ADD COLUMN     "fundingRound" TEXT,
ADD COLUMN     "headcount" INTEGER,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "products" TEXT,
ADD COLUMN     "totalFunding" INTEGER;
