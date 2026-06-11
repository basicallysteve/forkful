# Marketing pages live in an isolated route group with no PrimeReact dependency

The app's root layout is `force-dynamic` and imports the full PrimeReact stylesheet to support the authenticated app. Marketing pages (landing, about, blog) need to be statically generated for SEO and must not inherit this overhead. We created an `app/(marketing)/` route group with its own lightweight layout and SCSS — no PrimeReact, no recipe-fetching. The root `/` page stays in the root layout but conditionally renders a `MarketingNav` when the user is logged out.

## Considered Options

- **CMS (e.g. Contentful, Sanity)** — rejected because the sole author is a developer; MDX files in the repo are simpler and free.
- **Shared root layout for all pages** — rejected because the root layout's `getRecipes()` call and PrimeReact imports prevent static generation and add unnecessary weight to public-facing pages.
