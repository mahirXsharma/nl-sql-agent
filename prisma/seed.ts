import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PAINTINGS = [
  { title: "Midnight Monsoon", style: "Abstract", price: 2000 },
  { title: "Neon Gali", style: "Cyberpunk", price: 2500 },
  { title: "Quiet Chai", style: "Minimalist", price: 1500 },
  { title: "Golden Hour", style: "Impressionist", price: 2200 },
  { title: "Metro Rain", style: "Cyberpunk", price: 2800 },
  { title: "Terracotta Silence", style: "Minimalist", price: 1800 },
  { title: "Electric Bazaar", style: "Abstract", price: 2400 },
  { title: "Old Delhi Mist", style: "Impressionist", price: 2100 },
  { title: "Rain Drop", style: "Abstract", price: 1900 },
];

const CUSTOMERS = [
  { name: "Aarav", city: "Mumbai" },
  { name: "Diya", city: "Mumbai" },
  { name: "Rohan", city: "Delhi" },
  { name: "Ananya", city: "Delhi" },
  { name: "Kabir", city: "Delhi" },
  { name: "Meera", city: "Bengaluru" },
  { name: "Vihaan", city: "Bengaluru" },
  { name: "Ishita", city: "Jaipur" },
  { name: "Arjun", city: "Jaipur" },
  { name: "Sanya", city: "Pune" },
  { name: "Dev", city: "Pune" },
  { name: "Nisha", city: "Mumbai" },
];

const REACTION_TYPES = ["like", "love", "fire"];

// Generates a timestamp in the last 60 days, weighted toward evening peak hours (18:00 - 22:00)
function randomDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 60);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const isPeak = Math.random() < 0.65;
  const hour = isPeak
    ? 18 + Math.floor(Math.random() * 5) // 6 PM - 10 PM
    : Math.floor(Math.random() * 24);
  date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return date;
}

async function main() {
  // Wipe existing Art Store data so you can re-run seed safely
  await prisma.reaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.painting.deleteMany();
  await prisma.customer.deleteMany();

  const paintings = await Promise.all(
    PAINTINGS.map((p) => prisma.painting.create({ data: p }))
  );

  const customers = await Promise.all(
    CUSTOMERS.map((c) => prisma.customer.create({ data: c }))
  );

  // Seed 120 orders (weighted so Cyberpunk & Abstract sell more)
  const ordersData = Array.from({ length: 120 }).map(() => {
    const painting =
      Math.random() < 0.45
        ? paintings[Math.floor(Math.random() * 2)] // Midnight Monsoon / Neon Gali spike
        : paintings[Math.floor(Math.random() * paintings.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const quantity = Math.random() < 0.8 ? 1 : 2;

    return {
      paintingId: painting.id,
      customerId: customer.id,
      quantity,
      totalAmount: painting.price * quantity,
      createdAt: randomDate(),
    };
  });

  await prisma.order.createMany({ data: ordersData });

  // Seed 200 reactions
  const reactionsData = Array.from({ length: 200 }).map(() => {
    const painting = paintings[Math.floor(Math.random() * paintings.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const type = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];

    return {
      paintingId: painting.id,
      customerId: customer.id,
      type,
      createdAt: randomDate(),
    };
  });

  await prisma.reaction.createMany({ data: reactionsData });

  console.log("Seeded Art Store DB: 8 paintings, 12 customers, 120 orders, 200 reactions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });