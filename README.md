# Syno Package Land catalog

`catalog.yaml` is the single list of packages shown on synopkgland.com and served to DSM Package Center by packages.synopkgland.com.
Submit changes through a pull request. The package source refreshes merged changes within five minutes; the website also keeps a build-time fallback snapshot.
Before accepting a reviewed package, run the [local SPK port admission gate](SCHEMA.md#local-port-admission-gate) as well as the existing pin check.
SPK files stay in each package repository's GitHub Releases; packages.synopkgland.com streams them, nothing is stored in R2.
App screenshots (up to 5 per package) are linked from `metadata.screenshots`; see `SCHEMA.md` and `screenshots/README.md` for hosting, file names and size limits.
