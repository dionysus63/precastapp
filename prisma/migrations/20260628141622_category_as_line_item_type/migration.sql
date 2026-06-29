/*
  Warnings:

  - You are about to drop the column `category` on the `QuoteLineItem` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "QuoteLineType" ADD VALUE 'CATEGORY';

-- AlterTable
ALTER TABLE "QuoteLineItem" DROP COLUMN "category";
