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

From this checkout with Node 24:

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run test:community
npm run check:community
```

The included generated checker validates schema, ownership, namespace, unique
IDs, SHA-256/size, SPK INFO and claims. It needs no credentials; anonymous GitHub
rate limits may require a later retry. No SPK code is executed.

Open a PR against `synopackageland/catalog:main`. Wait for **Community schema,
ownership and SPK integrity** and maintainer review and merge. A first-time
fork workflow may need maintainer approval to start. Checks do not authorize
publisher registration or updates and do not publish automatically.

These packages receive no Package Center basic security check. After merge,
they are listed on the website only and linked to the author's Release.

The complete build-to-PR walkthrough and Package Center path are at
https://synopkgland.com/docs/guides/list-your-app/
