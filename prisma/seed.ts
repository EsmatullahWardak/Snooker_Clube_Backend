import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import {
  MembershipCode,
  PrismaClient,
  RoleName,
  TableStatus,
} from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error('DATABASE_URL is required to seed the database.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const requiredSeedValue = (name: string) => {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} is required. Copy values from .env.example and change them.`,
    );
  return value;
};

async function main() {
  const permissions = [
    'dashboard.read',
    'members.read',
    'members.write',
    'tables.read',
    'tables.write',
    'games.read',
    'games.write',
    'expenses.read',
    'expenses.create',
    'expenses.update',
    'payments.read',
    'reports.read',
    'staff.manage',
    'settings.manage',
  ];

  const permissionRows = await Promise.all(
    permissions.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      }),
    ),
  );

  const rolePermissions: Record<RoleName, string[]> = {
    ADMIN: permissions,
    MANAGER: permissions.filter(
      (code) => !['staff.manage', 'settings.manage'].includes(code),
    ),
    EMPLOYEE: [
      'dashboard.read',
      'members.read',
      'members.write',
      'tables.read',
      'games.read',
      'games.write',
      'expenses.read',
      'expenses.create',
    ],
  };

  const roles = new Map<RoleName, { id: string }>();
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name.toLowerCase()} access` },
    });
    roles.set(name, role);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionRows
        .filter((permission) => rolePermissions[name].includes(permission.code))
        .map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
    });
  }

  const accounts = [
    {
      role: RoleName.ADMIN,
      email: requiredSeedValue('SEED_ADMIN_EMAIL'),
      password: requiredSeedValue('SEED_ADMIN_PASSWORD'),
      firstName: 'System',
      lastName: 'Administrator',
    },
    {
      role: RoleName.MANAGER,
      email: requiredSeedValue('SEED_MANAGER_EMAIL'),
      password: requiredSeedValue('SEED_MANAGER_PASSWORD'),
      firstName: 'Club',
      lastName: 'Manager',
    },
    {
      role: RoleName.EMPLOYEE,
      email: requiredSeedValue('SEED_EMPLOYEE_EMAIL'),
      password: requiredSeedValue('SEED_EMPLOYEE_PASSWORD'),
      firstName: 'Club',
      lastName: 'Employee',
    },
  ];

  for (const account of accounts) {
    const roleId = roles.get(account.role)?.id;
    if (!roleId) throw new Error(`Missing role ${account.role}`);
    await prisma.user.upsert({
      where: { email: account.email.toLowerCase() },
      update: { roleId, status: 'ACTIVE', deletedAt: null },
      create: {
        email: account.email.toLowerCase(),
        passwordHash: await bcrypt.hash(account.password, 12),
        firstName: account.firstName,
        lastName: account.lastName,
        roleId,
      },
    });
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: requiredSeedValue('SEED_ADMIN_EMAIL').toLowerCase() },
  });

  const memberships = await Promise.all([
    prisma.membershipType.upsert({
      where: { code: MembershipCode.STANDARD },
      update: { name: 'Standard' },
      create: {
        code: MembershipCode.STANDARD,
        name: 'Standard',
        discountPercent: 0,
      },
    }),
    prisma.membershipType.upsert({
      where: { code: MembershipCode.PRO_PLAYER },
      update: { name: 'Pro Player' },
      create: {
        code: MembershipCode.PRO_PLAYER,
        name: 'Pro Player',
        discountPercent: 20,
      },
    }),
  ]);

  for (let number = 1; number <= 8; number += 1) {
    await prisma.snookerTable.upsert({
      where: { number },
      update: { name: `Table ${number}` },
      create: {
        number,
        name: `Table ${number}`,
        status: TableStatus.AVAILABLE,
      },
    });
  }

  const categories = [
    'Electricity',
    'Water',
    'Internet',
    'Cleaning Supplies',
    'Snooker Equipment',
    'Table Maintenance',
    'Rent',
    'Salaries',
    'Transportation',
    'Other',
  ];
  await Promise.all(
    categories.map((name) =>
      prisma.expenseCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  await prisma.clubSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', defaultHourlyRate: 100 },
  });

  const standard = memberships.find(
    (type) => type.code === MembershipCode.STANDARD,
  );
  const pro = memberships.find(
    (type) => type.code === MembershipCode.PRO_PLAYER,
  );
  if (!standard || !pro) throw new Error('Membership seed failed.');

  await prisma.member.upsert({
    where: { membershipNumber: 'MEM-0001' },
    update: {},
    create: {
      membershipNumber: 'MEM-0001',
      name: 'Ahmad Rahimi',
      phone: '+93 700 000 001',
      membershipTypeId: standard.id,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });
  await prisma.member.upsert({
    where: { membershipNumber: 'MEM-0002' },
    update: {},
    create: {
      membershipNumber: 'MEM-0002',
      name: 'Farid Ahmadi',
      phone: '+93 700 000 002',
      membershipTypeId: pro.id,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
