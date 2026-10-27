-- AlterTable
ALTER TABLE "public"."courses" ADD COLUMN     "kit_id" UUID;

-- CreateTable
CREATE TABLE "public"."kits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kit_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kit_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."included_kit_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_purchase_id" UUID NOT NULL,
    "kit_id" UUID NOT NULL,
    "order_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "included_kit_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."included_kit_claim_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "claim_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "included_kit_claim_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kit_items_product_id_idx" ON "public"."kit_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "kit_items_kit_id_product_id_key" ON "public"."kit_items"("kit_id", "product_id");

-- CreateIndex
CREATE INDEX "included_kit_claims_user_id_idx" ON "public"."included_kit_claims"("user_id");

-- CreateIndex
CREATE INDEX "included_kit_claims_kit_id_idx" ON "public"."included_kit_claims"("kit_id");

-- CreateIndex
CREATE UNIQUE INDEX "included_kit_claims_course_purchase_id_key" ON "public"."included_kit_claims"("course_purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "included_kit_claim_attempts_order_id_key" ON "public"."included_kit_claim_attempts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "included_kit_claim_attempts_idempotency_key_key" ON "public"."included_kit_claim_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "included_kit_claim_attempts_claim_id_idx" ON "public"."included_kit_claim_attempts"("claim_id");

-- AddForeignKey
ALTER TABLE "public"."courses" ADD CONSTRAINT "courses_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."kit_items" ADD CONSTRAINT "kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."kit_items" ADD CONSTRAINT "kit_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."included_kit_claims" ADD CONSTRAINT "included_kit_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."included_kit_claims" ADD CONSTRAINT "included_kit_claims_course_purchase_id_fkey" FOREIGN KEY ("course_purchase_id") REFERENCES "public"."course_purchases"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."included_kit_claims" ADD CONSTRAINT "included_kit_claims_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."included_kit_claims" ADD CONSTRAINT "included_kit_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."included_kit_claim_attempts" ADD CONSTRAINT "included_kit_claim_attempts_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."included_kit_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."included_kit_claim_attempts" ADD CONSTRAINT "included_kit_claim_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
