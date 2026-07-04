# Bolt Food UI Reference for Kibanda Express

Checked on 2026-07-03. Use this as inspiration for interaction patterns and screen structure only. Do not copy Bolt Food screenshots, brand marks, exact icon set, wording, or proprietary visual assets.

## Public Sources

- Official Bolt Food page: https://bolt.eu/en/food/
- Official iOS listing: https://apps.apple.com/az/app/bolt-food/id1451492388
- Official Google Play listing: https://play.google.com/store/apps/details?id=com.bolt.deliveryclient&hl=en-US
- UI pattern index: https://uiland.design/screens/boltfood/screens/8b3b323f-9f39-453c-bf2d-ac6989ae7c11

## What Bolt Food Gets Right

- The first screen is action-first: delivery location, search, quick reorder, promo banner, nearby restaurants, and a persistent bottom nav.
- Discovery is built around horizontal shelves with clear section titles and a compact "All" action.
- Food and vendor cards use large food photography, short metadata, rating/promotional badges, and fast add actions.
- Restaurant detail pages lead with a full-width food image, floating back/share/search controls, rating, delivery price, ETA, discount messaging, and repeat-order shelves.
- Checkout focuses on delivery address first, then drop-off notes, contactless delivery/help, payment, fees, and a single strong place-order control at the bottom.
- Tracking shows a big ETA, a vertical progress timeline, and order details below it, reducing the need to open support.
- Navigation stays simple: Home, Stores/Market, Search, Orders, Profile. The active route is visually obvious.

## Adaptation Rules For Kibanda

- Keep Kibanda Express visually original: warm Kenyan food photography, existing M-Pesa language, local vendor names, and the current primary/secondary color system.
- Use Bolt's information hierarchy, not Bolt's exact colors or screenshots.
- Replace generic "stores" language with "kibandas", "market", "orders", and "riders" where it fits the product.
- Prioritize thumb-friendly mobile spacing because this app already behaves like a mobile-first ordering product.
- Keep the current Material Symbols icon approach unless a broader icon-system change is planned.

## Screen Mapping

### Home: `app/page.tsx`, `components/Header.tsx`, `components/SearchBar.tsx`

- Keep the sticky delivery-location header, but reduce brand dominance so location and search feel like the first actions.
- Add a compact "Order again" or "Recent favorites" shelf above marketplace discovery once order history is available.
- Keep the marketplace CTA, but make it feel like a promo banner with one image/illustration area and one clear action.
- Consider adding a five-item bottom nav: Home, Market, Search, Orders, Profile. Cart can remain a badge/action inside Market or header if checkout flow supports it.

### Vendor And Food Cards: `components\NearbyVendors.tsx`, `components\MarketFoodCard.tsx`

- Keep large image-first cards.
- Standardize metadata badges: rating, ETA, delivery fee, promo.
- Put the add button as a round floating control on food imagery or at the lower-right content edge.
- Use concise labels: price, vendor, category, availability.

### Shop Detail: `app/shop/[shopId]/page.tsx`

- Use a full-width food/vendor hero.
- Overlay circular icon buttons for back, share/favorite, and search.
- Put rating, delivery fee, and ETA in a compact stat strip directly below the hero.
- Add shelves for "Order again", "Popular", and "Offers" before the full menu list.

### Checkout: `app/checkout/page.tsx`

- Start with delivery location and drop-off instructions.
- Keep payment/M-Pesa details visible before final confirmation.
- Use one sticky bottom action for "Place order" with total price.
- Make fees and small-order/delivery charges readable before the final action.

### Orders And Tracking: `app/orders/page.tsx`, `app/orders/[orderId]/page.tsx`, `convex/orderTracking.ts`

- Lead active orders with a large ETA/status block.
- Use a vertical progress timeline: confirmed, preparing, rider assigned, on the way, delivered.
- Keep order details below progress, not above it.
- Add quick support/help only after the progress state is visible.

### Seller/Rider/Admin

- Do not force the customer-app visual style onto operational dashboards.
- Borrow only the clarity patterns: status chips, timelines, compact stat cards, and prominent next action.

## Implementation Order

1. Refresh home hierarchy and bottom nav.
2. Standardize card metadata and add controls.
3. Redesign shop detail hero and menu sections.
4. Tighten checkout into a single bottom-confirm flow.
5. Upgrade order detail tracking timeline.

## Quick Design Tokens To Consider

- Background: keep the existing warm off-white.
- Primary action: keep Kibanda's existing primary unless a brand refresh is agreed.
- Success/status: use the existing green secondary for tracking states.
- Radius: use 16px for cards and 9999px for icon buttons/chips.
- Shadows: keep subtle shadows; food images should carry most of the visual energy.
