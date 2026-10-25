# Pandiyan Stores storefront design

Reference captured and inspected on 25 October 2026.

## Sources and observed patterns

- https://blinkit.com — retrieved with Firecrawl branding, markdown, images and full-page screenshot formats. The public desktop page was also opened and its pixels inspected in the browser. A location dialog covered part of the page. Observed: white header, delivery location beside the wordmark, wide search, green cart action, grocery masthead, small promotional panels and photographic category tiles. Personalised inventory, mobile states and checkout were not established by this reference capture.
- https://e-commerce-68o1.vercel.app/products — retrieved with the same Firecrawl formats. The source reports the existing Inter font stack and Pandiyan branding; its catalogue was in a loading state. A direct request to `/api/v1/categories/` returned the frontend HTML rather than JSON.

Firecrawl-reported reference tokens: yellow `#F8CB46`, green primary action `#0C831F`, white background, Okra/Helvetica font stack, 12px search-input corners. Reported colours and typography are extraction evidence; layout descriptions above come from the inspected pixels. No proprietary font or Blinkit logo is copied.

## Implementation choices

Use the store's own bag and hill mark with a yellow tile and green lettering. Retain the existing Inter/system font stack. Adapt quick commerce patterns into original components and copy.

| Role | Value |
| --- | --- |
| Primary action | `#0C831F` |
| Deep green / brand | `#115B30` |
| Primary text | `#202820` |
| Muted text | `#737A73` |
| Fine borders | `#E9ECE7` |
| Hero surface | `#EEF5DF` |
| Announcement | `#FFF8D6` |
| Catalogue surface | `#FBFCF9` |
| Card radius | 12px |
| Maximum content width | 1280px |
| Spacing unit | 4px |

These dimensions, sage surfaces and typography sizes are proposed adaptation values, not measurements of Blinkit CSS. Headlines use a compact sans-serif hierarchy; catalogue cards show actual price, MRP-derived savings, stock-aware quantity controls and a neutral per-item label when pack metadata is absent.

## Layout and components

The desktop header remains visible while shopping. It contains store identity, delivery PIN selection, live search with suggestions/recent terms, account and cart. The header's lower strip links to actual stocked categories.

Home contains an original grocery masthead, API-driven category tiles, three department panels, real product shelves, referral discovery and store-service details. Featured flags and MRP discounts come from returned inventory. Empty/error/loading states replace invented fallback stock.

The catalogue uses a left category rail and five product columns at full desktop width. It reduces to a narrow independently scrolling rail and two columns at 390px. Mobile has fixed bottom navigation and a separate basket summary when items are present. See `src/quick-commerce.css` for all breakpoints and reduced-motion support.

The cart uses a native dialog for focus containment, Escape dismissal and focus restoration. It reuses the full cart's stock/price validation and delivery calculation. Checkout remains the existing authenticated COD flow; sign-in and registration preserve the requested destination.

## Image references

Existing permanent assets in `frontend/public/images/categories/` are reused. Source provenance is in `frontend/src/data/departments.json`, with images originally from DummyJSON. Hero images are decorative illustrations of store departments, not offers or promises of stock. Product photos use API data; existing representative-photo fallbacks remain labelled.

## Verification and remaining gaps

Desktop and 390px layouts were visually inspected against a real local Django API with disposable sample inventory. Local captures accompany the change. The live site's API routing still needs deployment configuration verification. Delivery times, service PINs, order minimums and fees remain store-configured; this design does not introduce a 10-minute promise. Pack size, clothing size variants, online payments and live courier tracking are not added by this frontend change.
