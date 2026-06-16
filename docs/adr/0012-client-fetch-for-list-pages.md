# Client-side fetch for list pages

List pages (Recipes, Foods) fetch their own data on mount rather than receiving server-rendered initial data as props. The individual detail pages (`/recipes/[id]/[slug]`) remain fully server-rendered because they are the SEO surface — list pages are browsing UIs behind auth and are not indexed. The trade-off is a brief loading state (PrimeReact Skeleton) in exchange for eliminating the `storeHydrated` flag + `useEffect` hydration ceremony that existed to bridge the gap between server props and the Zustand store.

## Considered Options

- **SSR props + client hydration**: Server page fetches data, passes as `initialRecipes`/`initialFoods`, client component hydrates the store in a `useEffect` and guards against a flash with a `storeHydrated` flag. Instant first paint, but verbose and duplicates the source of truth.
- **Client-fetch on mount** *(chosen)*: Server page is a thin auth shell. Client component fetches its own data, shows a Skeleton while loading. Simpler and consistent with how Pantry already works.
