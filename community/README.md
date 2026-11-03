# Community packages

Fork the public packaging source and the [catalog](https://github.com/synopackageland/catalog).
Use `C<github_owner_id>X<Name>` as the package ID (ASCII letters/digits, at most
64 characters; Name starts with a letter). Set your own distributor/contact and
Compose resource prefix, keep upstream attribution and licenses, then build
with the public npm CLI and dependencies documented in the packaging README.
Publish the SPK in your own public versioned GitHub Release; never replace its
bytes or use `latest`. Record the actual SHA-256 and byte size.

Add `community/<lowercase GitHub login>/publisher.yaml` and one
`<package ID>.yaml`. Copy the full examples in [SCHEMA.md](../SCHEMA.md#community-packages),
including numeric owner/maintainer IDs, source repo/tag and asset pins. The
GitHub login, numeric publisher ID and public release repository owner must match.

From this checkout with the latest Node.js LTS:

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run test:community
npm run check:community
```

The included generated checker validates schema, ownership, namespace, unique
IDs, SHA-256/size, SPK INFO and claims. It needs no credentials; anonymous GitHub
rate limits may require a later retry. No SPK code is executed.

Open a PR against `synopackageland/catalog:main`. Wait for **Community schema,
ownership and SPK integrity** and maintainer review. If no check appears, ask
the maintainer to confirm repository Actions are enabled; absence is not a pass.

These packages receive no Package Center basic security check. After merge,
they appear in the [app community list](https://synopkgland.com/apps/?list=community)
and link directly to the publisher's Release. The site's top-nav Community link
opens the forum instead.

## Listing and moderation rules

- Listing is never automatic: passing CI does not list an app. A maintainer must
  merge the PR; every later update also needs a PR and maintainer merge.
- First-time contributors' CI waits for maintainer approval to start.
- SPKs must be publicly downloadable. Community submissions require a public
  GitHub Release repository owned by the publisher; source code may live
  elsewhere, including privately. Package Center submissions require a public
  Release or public HTTPS SPK, plus source access for maintainer review.
- A maintainer can remove an entry through a PR deleting
  `community/<publisher>/<package ID>.yaml`, or block it in `moderation.yaml`
  using `blocked_publishers`, `blocked_packages` or `blocked_sha256`. Blocked
  publishers/packages stay hidden even if re-added; blocked SPK hashes stay
  excluded from downloads (an entry with no remaining assets is hidden).
- Merged listing, update, removal and moderation changes normally take effect
  within about five minutes.
- To move from the app community list to Package Center, open an issue. After
  maintainer review and a basic security check report, the maintainer adds the
  package to `catalog.yaml` with artifact pins. Every new release is rechecked.

The complete build-to-PR walkthrough and Package Center requirements are in the
[submission guide](https://synopkgland.com/docs/guides/list-your-app/).
