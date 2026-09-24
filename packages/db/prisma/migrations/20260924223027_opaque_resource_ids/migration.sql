-- AlterTable
ALTER TABLE "events" ALTER COLUMN "resource_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "incidents" ALTER COLUMN "primary_resource_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "metric_samples" ALTER COLUMN "resource_id" SET DATA TYPE TEXT;
