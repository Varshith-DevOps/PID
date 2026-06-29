/** Backfill Company.subdomain from the tenant code for existing rows. */
const prisma = require('../src/config/database');
const { slugifySubdomain } = require('../src/utils/subdomain');

(async () => {
  const comps = await prisma.company.findMany({ where: { subdomain: null }, select: { id: true, code: true } });
  let done = 0;
  for (const c of comps) {
    let candidate = slugifySubdomain(c.code) || ('t-' + c.id.slice(0, 6));
    const clash = await prisma.company.findFirst({ where: { subdomain: candidate, NOT: { id: c.id } } });
    if (clash) candidate = (candidate + '-' + c.id.slice(0, 4)).slice(0, 63);
    await prisma.company.update({ where: { id: c.id }, data: { subdomain: candidate } });
    console.log(`  ${c.code} -> ${candidate}`);
    done++;
  }
  console.log(`Backfilled ${done} company subdomains.`);
  await prisma.$disconnectBase();
})().catch((e) => { console.error(e); process.exit(1); });
