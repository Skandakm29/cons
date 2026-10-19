-- OTP codes can now be sent to a phone or an email address.
ALTER TABLE "OtpCode" RENAME COLUMN "phone" TO "identifier";
ALTER INDEX "OtpCode_phone_createdAt_idx" RENAME TO "OtpCode_identifier_createdAt_idx";

-- Phone numbers entered at email/Google signup are not SMS-verified.
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
-- Every existing account was created through phone OTP (or seeded by the owner), so treat those as verified.
UPDATE "User" SET "phoneVerified" = true;
