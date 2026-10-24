# Storefront design reference — 25 October 2026

Source: https://blinkit.com, retrieved with Firecrawl branding, summary, markdown and screenshot requests. Public page confirms delivery/location, search, cart and broad photo-category hierarchy. Returned screenshot URL was not used for visual measurement; the user's attached mobile Diwali screenshot is the inspected festive reference. Public location-gated content did not establish today's personalised Diwali campaign.

Extracted tokens: primary yellow #F8CB46, white background, green primary buttons #0C831F, 12px input corner radius. Font reported as Okra; implementation uses existing local font stack, not a copied proprietary font.

Adaptation: oxblood #741c25, warm gold #ffe2a5, ivory #fcf5e5; compact department strip; restrained lamp motifs; prominent offer tabs; two mobile columns and six desktop columns. Original shopping-bag/hill vector mark references Theni. No sparkle icons, countdowns or invented actual inventory offers.

Permanent category images live in public/images/categories and are mapped in src/data/departments.json, including source URLs. Both live and demo homepage reference these images independently of demo products. Product offers remain labelled examples, with no cart actions. Replace SHOW_CATALOGUE_PREVIEW when verified stock is ready.

Delivery changed via settings migration 0008 to 30 minutes for legacy default windows. Existing custom windows are preserved. Deploy backend migrations for the new delivery default on production.
