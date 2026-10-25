# Catalogue image assets

Seven category photographs and 18 individual sample product photographs are stored in `frontend/public/images/catalogue/`. Each has a separate WebP file; categories do not reuse product pack shots or each other's artwork.

The images were created with the built-in image generation tool. Product images use the existing DummyJSON sample thumbnail as an identity reference. These are illustrative sample catalogue assets, not manufacturer-supplied photographs. Complete prompts, reference URLs and checksums are recorded in `frontend/public/images/catalogue/provenance.json`.

`productImageSource` replaces only the exact registered sample CDN paths (ignoring query strings and fragments). Uploaded media and other API URLs remain authoritative. An unknown or missing product photo never receives a generic category photo. The shared ProductImage component keeps the same product photo in lists, detail, cart and wishlist.

Category matching uses canonical names and whole-word aliases. In particular, “Toiletries” must never match “oil”. Unknown categories keep the shopping bag icon.

Validation: `pnpm test` includes category regression tests, unique paths/content checks for all 25 assets, sample catalogue coverage and uploaded-photo precedence. `pnpm build` verifies production bundling.
