# Catalog v2: publishers, review tiers and pinned delivery

`catalog.yaml` is the approval and discovery source of truth. SPKs stay on the
publisher's host. No SPK is uploaded into our repos, cache, D1 or R2.

## Metadata

SDK manifests (`dsm-package.yaml` schema 2, including native layouts, and compose
schema 1) accept an optional `metadata` object:

```yaml
metadata:
  contact_email: you@example.com
  support_email: support@example.com
  homepage: https://example.com
  source_url: https://github.com/you/app
  issues_url: https://github.com/you/app/issues
  license: MIT
  long_description:
    en: |-
      Describe your app in plain text.
      Paragraphs are preserved on the website.
    zh-TW: Translated description.
  changelog: |-
    Changes in this version.
  screenshots: [https://example.com/screenshot.png]
```

All fields are optional. Additional supported fields: maintainer_url, distributor,
distributor_url, support_url (HTTP(S) or mailto), helpurl. URLs must be safe schemes;
emails must have a valid shape. Text is bounded to 16,000 characters, combined
metadata to 32,000, screenshots to 12. `package-metadata.schema.json` documents it.

The CLI writes standard INFO fields and `spk_land_metadata` (escaped single-line
JSON for full multilingual/plain text). Standard changelog flattens newlines with
` · `; the website preserves full text. Existing description and i18n.info emit
INFO description/description_<DSM-language>. INFO metadata is preferred; Release
notes are the latest changelog fallback. Catalog metadata overrides are intended
for website/editorial data and migration; update a manifest and re-release if
metadata must also travel in the installed SPK. Catalog overrides can appear in
the index immediately, without modifying the SPK. Missing fields are not rendered.

## Trust and identity

- official: synopackageland's own releases, pinned and verified during download.
- verified: third-party artifacts security reviewed after granting GitHub source /
  build read access to synopackageland. Each approved pin carries reviewer, UTC
  time, immutable source commit and optional explicit source_repo. For verified
  HTTPS artifacts source_repo is required. Script checks the reviewed commit is
  readable; human review is still necessary. Trust is set by catalog maintainers,
  never derived from a publisher's submitted claim or from hash validation.
- community: not reviewed by synopackageland. Submitted/first-seen hashes detect
  changes but do not demonstrate safety. The index description says not reviewed
  and unsigned. Website/API show all tiers; `?trust=official|verified|community`
  filters them. Package Center defaults official + verified; community requires
  an explicit source URL with `trust=community` (can combine comma-separated tiers).

Publisher verified is **identity verification**, independent of artifact security
review and SPK signatures. All these SPKs are unsigned. Third-party publisher
contact and support emails are required; official defaults are
synopackageland@gmail.com. Third-party INFO.package must begin `<publisher-id>.` or appear in the maintainer-approved publisher `package_names` reservation;
identities are globally unique, case-insensitively. Namespace ownership and trust
are approved by maintainers; duplicate identities are hidden. Native SDK packages can keep
alphanumeric names through explicit package_names reservations, preserving the
SDK naming contract. Package ownership conflicts across publishers are refused.

## Sources and integrity

`PackageSource` separates release inventory, inspection and byte streaming.
Current adapters support private/public GitHub Releases and reviewed HTTPS files.
Official GitHub uses the existing secret. Third-party private GitHub requires a
separate `THIRD_PARTY_*` secret binding; it never receives the official token.
GitHub storage redirects are allowlisted without forwarding credentials. HTTPS
allows public DNS hostnames only, no credentials/IP/local hosts/custom ports;
redirects are refused. Maintainers must review host ownership/DNS and availability.
No URL comes from a user query. Third-party secret provisioning/submission UI is
outside this round.

Pins bind INFO package/version/full arch declaration to whole-SPK sha256/md5/size.
No pin means no listing or download, including legacy schema 1. Schema 1 selections
map to official GitHub entries; run the tool to add pins before upgrading.
A new Release version requires a new review/pin. Existing Reclaim and disabled
Connect are migrated together; no application SPK release is required for the
catalog metadata overrides.

At active requests, discovery/release/asset metadata caches expire after five
minutes; external URL assets are inspected each discovery refresh. There is no
background scan when idle. Hash mismatch hides the affected artifact, emits a
sanitized warning and rejects its download link. Publisher blocked, listed:false
and blocked_versions revoke all tiers at next cache refresh (up to five minutes).
Instant revocation needs a future centralized deny store.

Every tier currently **proxies and verifies** the download. Proxy avoids a
refresh/download TOCTOU: we retain the final chunk until SHA-256/MD5/size match,
then count and complete. If someone replaces bytes, the client gets a failed /
incomplete transfer and the changed artifact disappears at refresh. Successful
completed bytes match the pinned artifact. We do not rely solely on DSM MD5.
Actual Package Center MD5 refusal/install behavior was not verified on a NAS in
this task: **unknown**. No NAS was changed.

Redirect could reduce proxy work for community but cannot enforce download-time
SHA-256 and cannot accurately count completed downloads. It is not enabled.
50 MiB × 1,000 downloads = about 48.8 GiB transmitted through the proxy, plus cold
refresh traffic. Workers memory is 128 MB per isolate; Free CPU is 10 ms/request,
Paid default CPU is 30 s (configurable to 5 min). Streaming bounds payload memory;
512 MiB accepted SPK size is a parser bound, not a proven production capacity.
Measure large files and account plan before onboarding at scale; fetch deadline
remains 60 s. See [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/)
and [pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Counts

D1 `syno-package-downloads`, binding DOWNLOADS, uses one atomic daily UTC UPSERT per
completed, hash-valid GET. No IP, user agent, cookie or user identifier is stored.
HEAD, rejected/mismatching/cancelled downloads do not count. Total is all historical
versions; recent is today + 29 previous UTC dates. Per-version/arch-set counts are
also in API downloads; a multi-platform SPK counts once. D1 failures abort completion
rather than silently lose a count. Server completion cannot prove client receipt,
file persistence or installation. KV non-atomic read-modify-write would lose updates;
Analytics Engine sampling is unnecessary for this small exact counter.

## Candidate pin and review check

```sh
node --import tsx scripts/catalog/pin.mts --catalog /path/catalog.yaml --pin --reviewer NAME
node --import tsx scripts/catalog/pin.mts --catalog /path/catalog.yaml --check
```

GITHUB_TOKEN is read from the environment. Never pass credentials as argv. --pin writes candidates locally,
never publishes or approves automatically; --check reads current SPKs and fails
if any artifact is unapproved, malformed, overlapping, inconsistent or changed.
For HTTPS candidate pins the source must send a bounded Content-Length when no prior size pin exists. Supply --source-ref with an immutable source commit (or a
content reference for submitted community), and --source-repo owner/repo for verified HTTPS artifacts. Existing pins are audit history in
Git, not a claim that the tool performed security review.

Recommended next submission flow: public catalog PR containing publisher metadata,
external source and candidate pins, with maintainer human security/namespace/license
review plus --check. Catalog currently remains private; if kept private, use a
separate public submissions issue/PR repo and maintainers transfer approved records.
No third-party SPK is hosted in synopackageland repos/Releases. Do not enable public
submission until host, credential, namespace and security-review policies are ready.

## Schema 2 selection example

```yaml
schema: 2
publishers:
  example:
    display_name: Example Developer
    contact_email: contact@example.com
    support_email: support@example.com
    verified: false
    package_names: [ExampleApp] # Explicit native name reservation by maintainers
packages:
  - publisher: example
    trust: community
    source:
      kind: github-release
      repo: example/app
      release: v1.0.0
      access: public
    pins: [] # Hidden until a submitted candidate pin is recorded
    listed: true
```

A pin contains package, version, arch (array), sha256 (64 lowercase hex), md5
(32 lowercase hex), size (bytes), review.type (reviewed/submitted), review.reviewer,
review.reviewed_at (UTC ISO time), review.source_ref (40/64 hex immutable ref), and
optional review.source_repo. Publisher homepage and blocked are optional. Selection
featured, category, order retain their v1 defaults; blocked_versions is an optional
array of INFO.version values. Unknown fields, duplicate selections/pins, invalid
emails, unsafe URLs, malformed review records and namespace conflicts are refused.
