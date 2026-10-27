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
  description:
    ko: 짧은 설명이에요.
  long_description:
    en: |-
      Describe your app in plain text.
      Paragraphs are preserved on the website.
    zh-TW: Translated description.
  changelog: |-
    Changes in this version.
  screenshots:
    - https://raw.githubusercontent.com/synopackageland/catalog/main/screenshots/YourPackage/01-main.png
```

All fields are optional. `description` is a short text (up to 1,000 characters),
plain or a map of BCP-47 tags; the website shows a language's exact value on cards,
app pages, the page description and search, and otherwise falls back to the SPK INFO
`description_<lang>`, then the English description. A plain text counts as `en`.
Additional supported fields: maintainer_url, distributor,
distributor_url, support_url (HTTP(S) or mailto), helpurl. URLs must be safe schemes;
emails must have a valid shape. Text is bounded to 16,000 characters, combined
metadata to 32,000. `package-metadata.schema.json` documents it.

### Maintainer and distributor

Set explicit attribution in each catalog entry's `metadata`:

```yaml
metadata:
  maintainer: OpenList Team
  maintainer_url: https://github.com/OpenListTeam/OpenList
  distributor: Syno Package Land
  distributor_url: https://synopkgland.com/
```

For upstream-based Apps published by Syno Package Land, `maintainer` is the
upstream GitHub owner's display name (or login if none is set), and
`maintainer_url` is exactly `metadata.upstream.url`. The distributor is
Syno Package Land. Names must be nonempty single lines of at most 80 characters.
The schema rejects missing attribution or Syno Package Land as upstream
maintainer. The three product exceptions are SynoReclaim, SynoPkgConnect and
SynoPkgGopeed: set maintainer to Syno Package Land, maintainer_url to
https://synopkgland.com/, and omit a separate distributor.

The catalog overrides feed and website attribution without changing pinned SPK
bytes, hashes or INFO consistency checks. Set the same maintainer at the App
manifest's top level, with the other three fields in manifest `metadata`, so the
next rebuild carries the correct installed INFO too. Existing SPKs remain
installable; installed Package Center details change after a rebuild/upgrade.
Run `python3 scripts/check_attribution.py` and
`python3 -m unittest discover -s tests` locally before submitting.

### Screenshots

`screenshots` is a list of at most **5** `https://` image URLs, each up to 2,048
characters. `http://` is rejected. The App page shows them in order as a
horizontally scrolling gallery (16:10 frames, lazy loaded, no referrer sent);
a click opens the full image in a new tab. There is no per-image caption: the
page labels them "App screenshot 1…5" in the visitor's language.

Where to host them:

- **Catalog-hosted (recommended for reviewed packages):** commit the files to
  `screenshots/<PackageName>/` in this repository and link
  `https://raw.githubusercontent.com/synopackageland/catalog/main/screenshots/<PackageName>/<file>`.
  See `screenshots/README.md` for file names, size and format. raw.githubusercontent.com
  serves PNG and JPEG with the right `Content-Type`, `X-Content-Type-Options: nosniff`
  and `Access-Control-Allow-Origin: *`, with a 5-minute cache, so the URL embeds directly.
  It serves WebP as `application/octet-stream`, so use PNG or JPEG there.
- **Your own host:** any `https://` image URL works. You keep it available and
  unchanged; a broken link only leaves an empty frame.

The CLI writes standard INFO fields and `spk_land_metadata` (escaped single-line
JSON for full multilingual/plain text). Standard changelog flattens newlines with
` · `; the website preserves full text. Existing description and i18n.info emit
INFO description/description_<DSM-language>. INFO metadata is preferred; Release
notes are the latest changelog fallback. Catalog metadata overrides are intended
for website/editorial data and migration; update a manifest and re-release if
metadata must also travel in the installed SPK. Catalog overrides can appear in
the index immediately, without modifying the SPK. Missing fields are not rendered.

### App information

The app page shows what a user wants to know before installing. Some values
are read from the SPK; the rest are optional statements in `metadata`. Every
value is one word from a fixed list, shown in plain words in the visitor's
language; a missing or `unknown` value shows "—".

Read from the SPK when the pin is written (`pin.mts --pin`), stored as the
pin's `facts`, never written by hand:

| Field | Values | Read from |
| --- | --- | --- |
| `built_with` | `sdk`, `other` | SDK marker files |
| `sdk_backend` | `go`, `rust`, `python`, `node`, `binary`, `compose` | `sdk-package.json`, compose layout |
| `root_access` | `none`, `approval`, `required` | `conf/privilege` run-as; executor, `rootOps`, `delegate` |
| `runs` | `native`, `container` | `conf/resource` docker resources, Container Manager dependency |
| `access` | `admins`, `selected`, `everyone` | `sdk-package.json` entry |
| `account` | `dsm`, `own`, `none` | SDK app with a DSM window |
| `background` | `yes`, `no` | systemd user unit, container, jobs, delegate |
| `opens` | `dsm`, `web`, `none` | INFO `dsmuidir`, `adminport`, `adminurl` |
| `web_port` | 1–65535 | INFO `adminport` |
| `requires`, `conflicts` | package names | INFO `install_dep_packages`, `install_conflict_packages` |
| `shared_folders` | folder names | `conf/resource` data-share |
| `signed` | `true`, `false` | `syno_signature.asc` |

A value the SPK cannot show is left out. `background: no`, and `root_access`
for a package not built with the SDK, are left out unless the SPK shows
otherwise.

Optional statements in `metadata`; `unknown` is allowed for every enum:

| Field | Values |
| --- | --- |
| `root_access`, `runs`, `access`, `account`, `background`, `opens` | the values above |
| `internet` | `required`, `optional`, `none` |
| `telemetry` | `none`, `opt-in`, `on` |
| `upstream` | `{ name, url, license? }`: the open-source project the app is based on; `name` and `license` one line of at most 80 characters, `url` `https://` |
| `privacy_url` | `https://` URL |
| `privacy_note` | one line of at most 280 characters, plain or per language |

What the SPK shows wins: a statement that contradicts it is refused, for
example `metadata.root_access: none` on an SPK that runs a script as root.

`recommended: true` on a catalog.yaml entry puts it in the website's
Recommended section. Only the catalog owner sets it, and only on a checked
entry; community files cannot. `featured` stays a sort key: a featured app
comes first. "By Package Land" on the website comes from the publisher id
`synopackageland`, and "Based on X (open source)" from `metadata.upstream`.

### Checks

Run these from a syno-package-land checkout; `<catalog>` is a checkout of
this catalog repository.

```sh
node --import tsx scripts/catalog/pin.mts --catalog <catalog>/catalog.yaml --pin     # new pins, with facts
node --import tsx scripts/catalog/pin.mts --catalog <catalog>/catalog.yaml --facts   # add or refresh facts on existing pins
node --import tsx scripts/catalog/pin.mts --catalog <catalog>/catalog.yaml --check   # release check
node --import tsx scripts/catalog/check-community.mts --catalog-dir <catalog> --spk  # community pull request check
```

`--check` and `check-community.mts` fail with a message naming the field for
an unknown field, a value outside its list, a URL that is not `https://`, pin
facts that differ from the SPK, or a statement the SPK contradicts. The
package source Worker validates the same schema when it loads the catalog and
keeps serving the last good copy when a file is refused.

## Two sources, three website sections

The website lists Recommended (catalog.yaml entries with `recommended: true`),
In Package Center (the other catalog.yaml entries) and Community (community/).
How a developer gets listed, and how every new version is checked again, is on
the website: https://synopkgland.com/docs/guides/list-your-app/

- catalog.yaml (schema 3) lists only packages this site's maintainer ran the
  basic security check on: synopackageland's own releases, and third parties'
  public SPKs. Each pin records reviewer, UTC time and immutable source commit;
  `review.report_sha256` and `review.checklist: basic-v1` are optional. These
  are the only packages in the DSM Package Center source; `?trust=` is ignored.
- community/<publisher>/ holds packages nobody checked. They are on the
  website only, linked to the author's GitHub Release, with the pinned sha256
  shown. Source code and license are not required.

All these SPKs are unsigned. Schema 3 has no `trust` and no publisher
`verified`. Third-party publisher contact and support emails are required;
official defaults are support@synopkgland.com. Third-party INFO.package must
begin `<publisher-id>.` or appear in the maintainer-approved publisher
`package_names` reservation; identities are globally unique,
case-insensitively, and catalog.yaml wins over community for the same ID.

## Community packages

```yaml
# community/alice/publisher.yaml
schema: 1
display_name: Alice Chen
contact_email: alice@example.com
support_email: help@example.com
homepage: https://example.com      # optional
github_owner_id: 1234567
maintainers: [1234567]
```

```yaml
# community/alice/alice.MyApp.yaml   (file name = package ID)
schema: 1
package: alice.MyApp               # "<publisher>." prefix; no ".dev" suffix
version: 1.2.0-3
displayname: My App
description: Does one thing.       # optional
os_min_ver: 7.0-40000              # optional; DSM 7 or later
category: media                    # optional
icon: assets/icon.png              # optional PNG in the source repo at the tag
metadata: { license: MIT }         # optional
source: { repo: alice/app, release: v1.2.0-3 }   # owner = publisher; not "latest"
assets:
  - { name: app-x86_64.spk, arch: [x86_64], sha256: <64 hex>, size: 2048 }
```

Limits: 1–8 assets of at most 64 MiB with disjoint architectures, files of at
most 64 KiB, 10 packages per publisher, 200 in all. Tier fields (`trust`,
`review`, `featured`, `recommended`, `order`, `package_names`, `credential_binding`,
`facts`) are
refused. A broken package file hides that package; a broken or missing
publisher.yaml hides that publisher.

`moderation.yaml` blocks publishers, package IDs or single SPKs by sha256.
`reserved-names.yaml` refuses exact package IDs (`names`) and words in a
package ID or display name (`words`). If either cannot be read, no community
package is listed; checked packages are unaffected.

## Sources and integrity

`PackageSource` separates release inventory, inspection and byte streaming.
Current adapters support private/public GitHub Releases and reviewed HTTPS files.
Official GitHub uses the existing secret. Third-party private GitHub requires a
separate `THIRD_PARTY_*` secret binding; it never receives the official token.
GitHub storage redirects are allowlisted without forwarding credentials. HTTPS
allows public DNS hostnames only, no credentials/IP/local hosts/custom ports;
redirects are refused. Maintainers must review host ownership/DNS and availability.
No URL comes from a user query. Third-party secret provisioning and submission UI are not currently available.

Pins bind INFO package/version/full arch declaration to whole-SPK sha256/md5/size.
No pin means no listing or download, including legacy schema 1. Schema 1 selections
map to official GitHub entries; run the tool to add pins before upgrading.
A new Release version requires a new review/pin. Catalog metadata overrides do not require an application SPK release.

At active requests, discovery/release/asset metadata caches expire after five
minutes; external URL assets are inspected each discovery refresh. There is no
background scan when idle. Hash mismatch hides the affected artifact, emits a
sanitized warning and rejects its download link. Publisher blocked, listed:false
and blocked_versions revoke all tiers at next cache refresh (up to five minutes).
Instant revocation needs a future centralized deny store.

synopackageland's own releases are **proxied and verified**: we retain the
final chunk until SHA-256/MD5/size match, then count and complete. A third
party's public SPK is linked where it was published and listed only when
GitHub's asset `digest` (sha256) and size match a pin; DSM checks the feed `md5`
after download and refuses a mismatch, and those downloads are not counted.
Community SPKs never pass through the Worker.

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

Submit a pull request to this public catalog with publisher metadata, external
source and candidate pins. Maintainers review security, namespaces and licenses
and run --check and the local port admission gate below before accepting a reviewed entry.
No third-party SPK is hosted in synopackageland repos/Releases.

### Local port admission gate

Run from this catalog checkout with Python 3.11+, PyYAML 6.0.3 and the GitHub CLI
authenticated for the release repositories:

```sh
python3 -m venv /tmp/catalog-check-env
/tmp/catalog-check-env/bin/pip install PyYAML==6.0.3
/tmp/catalog-check-env/bin/python -m unittest discover -s tests -v
/tmp/catalog-check-env/bin/python scripts/check_ports.py
```

This is a required local review check alongside `pin.mts --check`; it does not
start GitHub Actions, publish anything, or change the CLI or package source Worker.
Downloads are temporary and removed after the check. For offline review, supply
`--spk-dir /path/to/spks` containing **every active pinned artifact**, including
each architecture. Non-GitHub sources use this offline mode.

The gate verifies each artifact's SHA-256, size and INFO identity against its pin,
then compares `(protocol, port)` across packages. It reads `conf/resource` and the
following declarations without extracting archives or running package code:

- `web-config.nginx-static-config.enable` and `.disable` port lists, including `both`
- `port-config.protocol-file` inside `package.tgz`, including `src.ports`,
  `dst.ports`, comma-separated lists, ranges and default TCP+UDP

These formats follow Synology's [Web Config](https://help.synology.com/developer-guide/resource_acquisition/web_config.html)
and [Port Config](https://help.synology.com/developer-guide/integrate_dsm/ports.html) specifications.
Repeated declarations and architecture variants of the same package share one
owner; a matching port in two different packages fails. All architectures are
compared conservatively. Unlisted entries, blocked publishers and blocked versions
are excluded. Missing/changed SPKs, duplicate or unreadable `conf/resource`, and
missing or malformed referenced port files fail closed. An empty resource object is
allowed for a package that declares no ports. A native SPK without `conf/resource`
declares no DSM-managed ports; it is checked for identity and listed under `skipped`.

Exit status is **0** for no conflict, **1** for conflicts (JSON names the packages,
protocol and port), and **2** for an incomplete/unreadable check. Existing catalog
conflicts must be fixed with new reviewed SPKs/pins before admission passes.
This gate covers declared ports only; it does not discover runtime/container
listeners, scan a NAS, reserve DSM system ports or inspect unreviewed community files.

## Schema 3 selection example

```yaml
schema: 3
publishers:
  example:
    display_name: Example Developer
    contact_email: contact@example.com
    support_email: support@example.com
    package_names: [ExampleApp] # Explicit native name reservation by maintainers
packages:
  - publisher: example
    source:
      kind: github-release
      repo: example/app
      release: v1.0.0
      access: public            # a third party's SPK must be public
    info:                       # the Worker never reads a third party's SPK
      displayname: Example App
      description: Does one thing.
      os_min_ver: 7.0-40000
    pins: [] # Hidden until a reviewed pin is recorded
    listed: true
```

A pin contains package, version, arch (array), sha256 (64 lowercase hex), md5
(32 lowercase hex), size (bytes), review.type (reviewed/submitted), review.reviewer,
review.reviewed_at (UTC ISO time), review.source_ref (40/64 hex immutable ref), and
optional review.source_repo. Publisher homepage and blocked are optional. Selection
featured, category, order retain their v1 defaults; blocked_versions is an optional
array of INFO.version values. Unknown fields, duplicate selections/pins, invalid
emails, unsafe URLs, malformed review records and namespace conflicts are refused.
