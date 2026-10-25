# Pandiyan Stores storefront design

Reference captured and inspected on 25 October 2026.

## Sources and observed patterns

- https://blinkit.com — retrieved with Firecrawl branding, markdown, images and full-page screenshot formats. The public desktop page was also opened and its pixels inspected in the browser. A location dialog covered part of the page. Observed: white header, delivery location beside the wordmark, wide search, green cart action, grocery masthead, small promotional panels and photographic category tiles. Personalised inventory, mobile states and checkout were not established by this reference capture.
- https://e-commerce-68o1.vercel.app/products — retrieved with the same Firecrawl formats. The source reports the existing Inter font stack and Pandiyan branding; its catalogue was in a loading state. A direct request to `/api/v1/categories/` returned the frontend HTML rather than JSON.

Firecrawl-reported reference tokens: yellow `#F8CB46`, green primary action `#0C831F`, white background, Okra/Helvetica font stack, 12px search-input corners. Reported colours and typography are extraction evidence; layout descriptions above come from the inspected pixels. No proprietary font or Blinkit logo is copied.

## Implementation choices

Use the store's own bag and hill mark with a yellow tile and green lettering. Use locally hosted Lato (400, 700 and 900) under its included SIL Open Font License. It is a close available substitute for the reported Okra family, not an exact font match. An exact Okra match requires the original licensed font assets. Adapt quick commerce patterns into original components and copy.

| Role | Value |
| --- | --- |
| Primary action | `#0C831F` |
| Deep green / brand | `#115B30` |
| Primary text | `#202820` |
| Muted text | `#737A73` |
| Fine borders | `#E9ECE7` |
| Hero surface | `#2C783A` with full-colour grocery photography |
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

Realistic promotional artwork in `frontend/public/images/storefront/` is generated with the built-in image generation tool and encoded as WebP. It illustrates departments; actual product photos still come from inventory. Original permanent assets in `frontend/public/images/categories/` remain for clothing, dairy and perfume. Source provenance is in `frontend/src/data/departments.json`, with images originally from DummyJSON. Hero images are decorative illustrations of store departments, not offers or promises of stock. Product photos use API data; existing representative-photo fallbacks remain labelled.

## Verification and remaining gaps

Desktop and 390px layouts were visually inspected against a real local Django API with disposable sample inventory. Local captures accompany the change. The live site's API routing still needs deployment configuration verification. Delivery times, service PINs, order minimums and fees remain store-configured; this design does not introduce a 10-minute promise. Pack size, clothing size variants, online payments and live courier tracking are not added by this frontend change.


## Supplied screenshot typography and photography update

The user-supplied Blinkit screenshot (1488 × 646) was inspected directly on 25 October 2026. It shows a wide green grocery banner, three colourful photo promotions, and image-led category tiles. Banner lettering is baked into the reference imagery, so DOM extraction does not establish its exact font. Firecrawl's fresh capture of blinkit.com again reports Okra for the interface.

Visual estimates implemented at desktop width: 44px/700 hero heading, 26–28px/400 hero copy, 20px/700 hero CTA, 28px/900 promotion headings, 14px promotion copy/buttons and category captions. The interface uses 13px product titles, 12px pack/MRP labels, 14px navigation and 24px shelf headings. Mobile sizes adapt to the narrower viewport; the supplied screenshot does not establish mobile measurements. These are reference-matched visual estimates, not a pixel-exact or proprietary-font claim.

All live storefront typography is scoped to the customer layout. Lato is downloaded from Google Fonts, served locally and accompanied by `frontend/public/fonts/OFL-Lato.txt`. The hero and promotion text remain HTML, so they stay accessible, responsive and editable. No tracking request to a third-party font host is required at runtime.

Four original photorealistic assets replace the former isolated thumbnail hero and muted promotion styling: fresh groceries, fresh vegetables, pantry staples, and personal care. WebP assets total approximately 701 KB. Category illustrations reuse the corresponding photo crops without inventing product stock. Generation briefs and source provenance are recorded in `frontend/public/images/storefront/provenance.json`.
