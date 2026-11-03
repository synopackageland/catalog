# Syno Package Land catalog

The website has two package sources:

- `catalog.yaml`: reviewed packages served to DSM Package Center
- `community/`: the website's [app community list](https://synopkgland.com/apps/?list=community)

Submit changes through a pull request. See the complete
[build-to-submission guide](https://synopkgland.com/docs/guides/list-your-app/) and
[listing, update and moderation rules](community/README.md#listing-and-moderation-rules).
Merged changes normally appear within about five minutes; the website also keeps
a build-time fallback snapshot.

Only checked Package Center SPKs are streamed and verified against their pins
through packages.synopkgland.com. Community packages link directly to the
publisher's own public GitHub Release and are not served through the package source.
Before accepting a reviewed package, run the [local SPK port admission gate](SCHEMA.md#local-port-admission-gate)
as well as the existing pin check.
App screenshots (up to 5 per package) are linked from `metadata.screenshots`; see `SCHEMA.md` and `screenshots/README.md` for hosting, file names and size limits.

Upstream-based Apps name the upstream owner as maintainer and Syno Package Land as
distributor. Only Reclaim, Connect and Download Hub retain Syno Package Land as
maintainer. Run `python3 scripts/check_attribution.py` before submitting catalog
changes; the package-source schema enforces the same rule.
