import { mutation } from "./_generated/server";
import { catalog } from "../lib/data";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type DemoShop = {
  email: string;
  shopName: string;
  ownerName: string;
  location: string;
  phone: string;
  banner: string;
  logo: string;
  categories: string[];
  // which catalog categories to stock from
  stock: { category: keyof typeof catalog; count: number }[];
  featured: boolean;
};

const DEMOS: DemoShop[] = [
  {
    email: "demo-mama-njeri@kibanda.dev",
    shopName: "Mama Njeri's Kitchen",
    ownerName: "Jane Njeri",
    location: "Westlands, Nairobi",
    phone: "254712345678",
    banner: "https://loremflickr.com/640/360/kenyan,food?lock=900",
    logo: "https://loremflickr.com/200/200/chef?lock=901",
    categories: ["Breakfast", "Lunch", "Local Meals"],
    stock: [
      { category: "Breakfast", count: 4 },
      { category: "Lunch", count: 4 },
      { category: "Local Meals", count: 4 },
    ],
    featured: true,
  },
  {
    email: "demo-pilau-master@kibanda.dev",
    shopName: "The Pilau Master",
    ownerName: "Ali Hassan",
    location: "South B, Nairobi",
    phone: "254700111222",
    banner: "https://loremflickr.com/640/360/pilau,rice?lock=902",
    logo: "https://loremflickr.com/200/200/spices?lock=903",
    categories: ["Lunch", "Drinks", "Snacks"],
    stock: [
      { category: "Lunch", count: 3 },
      { category: "Drinks", count: 5 },
      { category: "Snacks", count: 4 },
    ],
    featured: false,
  },
];

/** Idempotent: builds demo sellers + shops + published food. Safe to re-run. */
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results: string[] = [];

    for (const demo of DEMOS) {
      // Skip if this demo seller already exists.
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", demo.email))
        .unique();
      if (existing) {
        results.push(`${demo.shopName}: exists`);
        continue;
      }

      const userId = await ctx.db.insert("users", {
        email: demo.email,
        name: demo.ownerName,
      });
      await ctx.db.insert("profiles", {
        userId,
        role: "seller",
        displayName: demo.ownerName,
        createdAt: now,
      });
      await ctx.db.insert("sellerProfiles", {
        userId,
        businessName: demo.shopName,
        ownerName: demo.ownerName,
        phone: demo.phone,
        location: demo.location,
        verification: "verified",
        accountStatus: "active",
        createdAt: now,
      });
      await ctx.db.insert("sellerSubscriptions", {
        sellerId: userId,
        planKey: demo.featured ? "premium" : "monthly",
        status: "active",
        startsAt: now,
        expiresAt: now + YEAR_MS,
        createdAt: now,
      });
      const shopId = await ctx.db.insert("shops", {
        ownerId: userId,
        name: demo.shopName,
        description: `${demo.shopName} — fresh Kenyan food made to order.`,
        logo: demo.logo,
        banner: demo.banner,
        location: demo.location,
        phone: demo.phone,
        whatsapp: demo.phone,
        openHour: "08:00",
        closeHour: "21:00",
        fulfilment: ["delivery", "pickup"],
        categories: demo.categories,
        active: true,
        featured: demo.featured,
        ratingAvg: 4.6,
        ratingCount: 24,
        createdAt: now,
      });

      let count = 0;
      for (const { category, count: n } of demo.stock) {
        const items = (catalog[category] ?? []).slice(0, n);
        for (const item of items) {
          await ctx.db.insert("foodItems", {
            shopId,
            sellerId: userId,
            name: item.name,
            category: category as string,
            description: `Freshly prepared ${item.name.toLowerCase()} from ${demo.shopName}.`,
            tags: item.tag ? [item.tag.toLowerCase()] : [],
            price: item.price,
            quantity: 50,
            prepTimeMins: 20,
            image: item.image,
            availability: "available",
            status: "published",
            boosted: false,
            soldCount: Math.floor(Math.random() * 15),
            createdAt: now,
          });
          count++;
        }
      }
      results.push(`${demo.shopName}: created with ${count} items`);
    }

    return results;
  },
});
