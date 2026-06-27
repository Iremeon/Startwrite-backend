import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Admin user ──
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@startwrite.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const adminName = process.env.ADMIN_FULL_NAME || 'Startwrite Admin';

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      authProvider: 'local',
      role: 'admin',
      isEmailVerified: true,
    },
  });
  console.log(`Admin user ready: ${admin.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(
      '  (using default password "ChangeMe123!" — set ADMIN_PASSWORD in .env to override)',
    );
  }

  // ── Pricing tiers — Class A/B/C, admin-adjustable later without touching templates ──
  await prisma.pricingTier.upsert({
    where: { templateClass: 'A' },
    update: {},
    create: { templateClass: 'A', price: 3.0 },
  });
  await prisma.pricingTier.upsert({
    where: { templateClass: 'B' },
    update: {},
    create: { templateClass: 'B', price: 2.0 },
  });
  await prisma.pricingTier.upsert({
    where: { templateClass: 'C' },
    update: {},
    create: { templateClass: 'C', price: 1.0 },
  });
  console.log('Seeded pricing tiers: A=$3.00, B=$2.00, C=$1.00');

  // ── Wallet top-up packages — fixed amounts, scalable later ──
  const packages = [
    { label: 'Starter', amount: 5.0 },
    { label: 'Growth', amount: 10.0 },
    { label: 'Pro', amount: 20.0 },
  ];
  for (const pkg of packages) {
    const existing = await prisma.walletPackage.findFirst({ where: { label: pkg.label } });
    if (!existing) {
      await prisma.walletPackage.create({ data: pkg });
    }
  }
  console.log('Seeded wallet top-up packages: Starter $5, Growth $10, Pro $20');

  // ── Categories + Subcategories ──
  const categoriesData = [
    {
      name: 'Human Resources',
      slug: 'human-resources',
      description: 'HR policies, hiring, and onboarding templates',
      subcategories: [
        { name: 'Recruitment & Hiring', slug: 'recruitment-hiring' },
        { name: 'Onboarding', slug: 'onboarding' },
      ],
    },
    {
      name: 'Finance',
      slug: 'finance',
      description: 'Invoicing, budgeting, and financial planning templates',
      subcategories: [
        { name: 'Invoicing', slug: 'invoicing' },
        { name: 'Budgeting', slug: 'budgeting' },
      ],
    },
    {
      name: 'Legal',
      slug: 'legal',
      description: 'Contracts, NDAs, and other legal document templates',
      subcategories: [
        { name: 'Contracts', slug: 'contracts' },
        { name: 'NDAs', slug: 'ndas' },
      ],
    },
  ];

  const createdSubcategories: { id: string; slug: string }[] = [];

  for (let i = 0; i < categoriesData.length; i++) {
    const cat = categoriesData[i];
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        displayOrder: i,
      },
    });

    for (let j = 0; j < cat.subcategories.length; j++) {
      const sub = cat.subcategories[j];
      const existing = await prisma.subcategory.findFirst({
        where: { categoryId: category.id, slug: sub.slug },
      });
      const subcategory = existing
        ? existing
        : await prisma.subcategory.create({
            data: {
              categoryId: category.id,
              name: sub.name,
              slug: sub.slug,
              displayOrder: j,
            },
          });
      createdSubcategories.push({ id: subcategory.id, slug: subcategory.slug });
    }
  }
  console.log(`Seeded ${categoriesData.length} categories with subcategories.`);

  // ── Sample templates — each assigned a pricing class (A/B/C) ──
  const recruitment = createdSubcategories.find(s => s.slug === 'recruitment-hiring');
  const invoicing = createdSubcategories.find(s => s.slug === 'invoicing');
  const contracts = createdSubcategories.find(s => s.slug === 'contracts');

  const sampleTemplates = [
    {
      subcategoryId: recruitment?.id,
      title: 'Employment Offer Letter',
      slug: 'employment-offer-letter',
      description: 'A standard offer letter template for new hires.',
      fileUrl: 'https://res.cloudinary.com/demo/placeholder/offer-letter.docx',
      fileType: 'docx',
      templateClass: 'C' as const,
    },
    {
      subcategoryId: invoicing?.id,
      title: 'Professional Invoice Template',
      slug: 'professional-invoice-template',
      description: 'A clean, itemized invoice template for client billing.',
      fileUrl: 'https://res.cloudinary.com/demo/placeholder/invoice.xlsx',
      fileType: 'xlsx',
      templateClass: 'B' as const,
    },
    {
      subcategoryId: contracts?.id,
      title: 'Service Agreement Contract',
      slug: 'service-agreement-contract',
      description: 'A comprehensive service agreement for freelancers and agencies.',
      fileUrl: 'https://res.cloudinary.com/demo/placeholder/service-agreement.docx',
      fileType: 'docx',
      templateClass: 'A' as const,
    },
  ];

  for (const tpl of sampleTemplates) {
    if (!tpl.subcategoryId) continue;
    await prisma.template.upsert({
      where: { slug: tpl.slug },
      update: {},
      create: { ...tpl, subcategoryId: tpl.subcategoryId, uploadedById: admin.id },
    });
  }
  console.log(`Seeded ${sampleTemplates.length} sample templates (Class A, B, C).`);

  console.log('Seeding complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
