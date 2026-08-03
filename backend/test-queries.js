const prisma = require('./src/config/database');

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) {
    console.log("No company found");
    return;
  }
  let plan = await prisma.plan.findFirst({ where: { name: 'Professional' } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        name: 'Professional',
        description: 'Perfect for growing businesses.',
        price: 6999.00,
        billingCycle: 'MONTHLY',
        employeeLimit: 50,
        featureLimits: JSON.stringify({ coreHR: true, attendance: true, leave: true, payroll: true, performance: true, learning: true, helpdesk: true }),
      }
    });
  }

  const sub = await prisma.subscription.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      paymentProvider: 'MOCK',
      providerSubscriptionId: 'sub_mock_12345',
    }
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { subscriptionId: sub.id }
  });

  console.log("Subscription created:", sub.id);
}
main().then(() => process.exit(0));
