# Reference previews

This package owns transient preview types, pure source descriptions, and composed
React presentation. It has no database, editor, or server-fetching dependency.
Preview results do not change the Journl document storage contract.

`describeExternal()` supplies labels and semantic icons without network access.
Its ordered sources classify GitHub resources, then fall back to websites.
`PreviewIcon`, `PreviewImage`, and `PreviewStatus` can be composed into either
editor's existing surfaces. Unknown icons fall back to an external-link icon.

Server providers live in `apps/web/src/references`. A provider combines a source
description with `resolve(url, context, signal)`. Register it before the website
fallback in `external-preview.ts`. Add its pure source to `previewSources` if it
needs offline classification in Explore or before enrichment. API orchestration
and renderers do not need a new platform branch.

Providers must honor the abort signal and use the bounded, DNS-pinned transport.
The default cache scope includes owner, connection ID, and connection revision.
Only public, credential-free providers may explicitly opt into public sharing.
Connection identifiers are opaque; credentials never belong in cache keys or
preview payloads. Authenticated platforms are future work.

The server pipeline uses bounded LRU caches and a bounded admission queue with
`p-limit`. These are per-process resource protections, not distributed quotas.
Admission refusal is retryable and is not stored as a negative metadata result.

Website metadata uses Metascraper's title, description, and image rules against
supplied, bounded HTML. No scripts, browser, hosted API, or discovered oEmbed
endpoints execute. Public thumbnails load directly with no referrer and disappear
on failure. They are not authenticated media; future private sources need an
explicit media-delivery policy before exposing images.
