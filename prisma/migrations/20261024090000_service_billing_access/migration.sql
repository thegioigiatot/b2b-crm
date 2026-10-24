-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bookingKey" TEXT,
ADD COLUMN     "paymentId" TEXT;

-- CreateTable
CREATE TABLE "ServiceContract" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cadenceMonths" INTEGER NOT NULL DEFAULT 0,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "agencyFee" DECIMAL(18,0) NOT NULL,
    "mediaBudget" DECIMAL(18,0) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "productGroupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPeriod" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "dueOn" DATE NOT NULL,
    "agencyFee" DECIMAL(18,0) NOT NULL,
    "mediaBudget" DECIMAL(18,0) NOT NULL,
    "vatAmount" DECIMAL(18,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePayment" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "receiptKey" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "agencyAmount" DECIMAL(18,0) NOT NULL,
    "mediaAmount" DECIMAL(18,0) NOT NULL,
    "vatAmount" DECIMAL(18,0) NOT NULL,
    "reference" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceContract_dealId_key" ON "ServiceContract"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPeriod_contractId_cycle_key" ON "BillingPeriod"("contractId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePayment_receiptKey_key" ON "ServicePayment"("receiptKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_bookingKey_key" ON "Order"("bookingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentId_key" ON "Order"("paymentId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ServicePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceContract" ADD CONSTRAINT "ServiceContract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ServiceContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePayment" ADD CONSTRAINT "ServicePayment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "BillingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

