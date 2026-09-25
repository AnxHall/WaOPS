/*
  Warnings:

  - The primary key for the `metric_samples` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "metric_samples" DROP CONSTRAINT "metric_samples_pkey",
ADD CONSTRAINT "metric_samples_pkey" PRIMARY KEY ("id", "observed_at");
