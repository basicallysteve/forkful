# ADR-0023: Denylist-Based URL Fetch Guard for URL Recipe Import

**Status:** Accepted

## Context

URL Recipe Import fetches a user-supplied URL server-side (`fetch(url)` in `scrapeRecipeFromUrl`) and runs it through the `recipe-scrapers` library. Fetching an arbitrary URL from the server is a classic server-side request forgery (SSRF) vector: although the endpoint is auth-gated, any logged-in user could point it at internal targets the browser could never reach — `http://localhost:…`, private ranges (`10.x`, `192.168.x`, `172.16–31.x`), or a cloud metadata endpoint (`http://169.254.169.254/…`) which on our hosting infra (Vercel/Supabase) can leak credentials.

We need to constrain what the server is willing to fetch.

## Decision

Apply a **URL Fetch Guard** before fetching:

1. Require an `http` or `https` scheme.
2. Reject hostnames resolving to loopback, private, or link-local ranges: `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`.
3. Bound the fetch with a timeout and a maximum response size so a hanging or enormous page cannot wedge the request.

The guard is a **denylist of known-dangerous destinations**, not a resolve-then-pin scheme.

## Rationale

- **Denylist covers the realistic threats now.** The concrete risks (metadata endpoint, obvious private ranges) are enumerable and blocked directly, with no added infrastructure.
- **Scheme + host checks are cheap and synchronous.** They run before any network call, so a rejected URL never touches the network.
- **Bounding size/time is orthogonal hygiene** that also protects against slow or hostile public pages, not just SSRF.

## Alternatives Considered

- **DNS-resolution pinning (resolve the hostname, verify every resolved IP is public, then fetch that IP).** More robust — it defeats DNS-rebinding and hostnames that alias private IPs, which a static host denylist does not. Rejected for now as heavier (custom DNS resolution + connecting by IP while preserving SNI/Host) than warranted for an auth-gated, low-traffic hobby feature. Documented here so the upgrade path is explicit if this endpoint is ever exposed more broadly.
- **No guard (rely on auth-gating alone).** Rejected: authentication limits *who* can trigger the fetch, not *what* it can reach. Every registered user would still have an internal-network probe.

## Consequences

- A user pasting an intranet or metadata URL gets a rejection, not a fetch.
- The guard is a static host denylist: it does **not** defend against DNS rebinding or public hostnames that resolve to private IPs. If URL Recipe Import is ever opened to untrusted or higher-volume use, revisit this in favour of DNS-resolution pinning.
- The guard logic is a standalone, unit-tested function so its rejection rules can be verified in isolation.
