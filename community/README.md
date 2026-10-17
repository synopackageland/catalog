# Community packages

One directory per publisher: `community/<publisher>/publisher.yaml` and one
`<package>.yaml` per package. Nobody runs the basic security check on these;
they are listed on the website only, never in the DSM Package Center source,
and their SPKs are linked where the author published them.

Fields, the optional app information (fixed value lists, `https://` links)
and the checks every pull request must pass are in `../SCHEMA.md`. Values the
SPK shows are read from it; a statement that contradicts the SPK is refused.

To get an app into Package Center instead, see
https://synopkgland.com/docs/guides/list-your-app/
