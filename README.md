# Syno Package Land catalog

`catalog.yaml` is the single list of packages shown on synopkgland.com and served to DSM Package Center by packages.synopkgland.com.
Edit it and commit to `main`; the package source and website pick up the change within minutes, with no redeploy.
SPK files stay in each package repository's GitHub Releases; packages.synopkgland.com streams them, nothing is stored in R2.
App screenshots (up to 5 per package) are linked from `metadata.screenshots`; see `SCHEMA.md` and `screenshots/README.md` for hosting, file names and size limits.
