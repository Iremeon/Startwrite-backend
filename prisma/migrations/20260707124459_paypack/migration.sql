/*
  Warnings:

  - You are about to drop the column `stripe_payment_intent_id` on the `wallet_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_session_id` on the `wallet_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "wallet_transactions" DROP COLUMN "stripe_payment_intent_id",
DROP COLUMN "stripe_session_id",
ADD COLUMN     "payment_ref" TEXT;
