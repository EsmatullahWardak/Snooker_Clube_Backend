-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MembershipCode" AS ENUM ('STANDARD', 'PRO_PLAYER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'RESERVED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOBILE_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" UUID NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_types" (
    "id" UUID NOT NULL,
    "code" "MembershipCode" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "membershipNumber" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "fatherName" VARCHAR(150),
    "photoUrl" VARCHAR(500),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "address" TEXT,
    "membershipTypeId" UUID NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATE,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snooker_tables" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "hourlyRateOverride" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snooker_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "tableId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "hourlyRateSnapshot" DECIMAL(12,2) NOT NULL,
    "membershipCodeSnapshot" "MembershipCode" NOT NULL,
    "discountPercentSnapshot" DECIMAL(5,2) NOT NULL,
    "baseAmount" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "finalAmount" DECIMAL(12,2),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" UUID NOT NULL,
    "endedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "receiptNumber" VARCHAR(50) NOT NULL,
    "gameId" UUID,
    "memberId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" UUID NOT NULL,
    "reference" VARCHAR(120),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "categoryId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "vendor" VARCHAR(180),
    "description" TEXT,
    "receiptUrl" VARCHAR(500),
    "reference" VARCHAR(120),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_settings" (
    "id" VARCHAR(30) NOT NULL DEFAULT 'default',
    "clubName" VARCHAR(150) NOT NULL DEFAULT 'Kabul Snooker Club',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AFN',
    "defaultHourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Kabul',
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resourceType" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(80),
    "before" JSONB,
    "after" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_deletedAt_idx" ON "users"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "membership_types_code_key" ON "membership_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "members_membershipNumber_key" ON "members"("membershipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE INDEX "members_name_idx" ON "members"("name");

-- CreateIndex
CREATE INDEX "members_status_deletedAt_idx" ON "members"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "members_membershipTypeId_idx" ON "members"("membershipTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "snooker_tables_number_key" ON "snooker_tables"("number");

-- CreateIndex
CREATE INDEX "snooker_tables_status_idx" ON "snooker_tables"("status");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_code_key" ON "game_sessions"("code");

-- CreateIndex
CREATE INDEX "game_sessions_status_startTime_idx" ON "game_sessions"("status", "startTime");

-- CreateIndex
CREATE INDEX "game_sessions_tableId_status_idx" ON "game_sessions"("tableId", "status");

-- CreateIndex
CREATE INDEX "game_sessions_memberId_startTime_idx" ON "game_sessions"("memberId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptNumber_key" ON "payments"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gameId_key" ON "payments"("gameId");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- CreateIndex
CREATE INDEX "payments_memberId_paymentDate_idx" ON "payments"("memberId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");

-- CreateIndex
CREATE INDEX "expenses_categoryId_expenseDate_idx" ON "expenses"("categoryId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_createdById_idx" ON "expenses"("createdById");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_membershipTypeId_fkey" FOREIGN KEY ("membershipTypeId") REFERENCES "membership_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "snooker_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_settings" ADD CONSTRAINT "club_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
