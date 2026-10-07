# Catalog schema 1

`catalog.yaml` is the only list of published packages. Commit changes on main;
the package-source Worker refreshes its catalog/Release cache within about five
minutes at each active Cloudflare location. Website rebuilds are unnecessary.

Each item needs `repo: synopackageland/<repository>` and `release: latest` or an
exact published, non-prerelease tag (for example `v0.1.0-0018`). Optional fields:

| Field | Default | Meaning |
| --- | --- | --- |
| listed | true | false disables discovery, resolution, icons and downloads |
| featured | false | Editorial featured marker exposed by the website API |
| category | utilities | Lowercase category slug, up to 41 characters |
| order | 100 | Integer 0–10000; smaller values sort first |

Only private repositories under synopackageland are accepted. No token, SPK URL,
package/version/architecture/checksum or other INFO metadata belongs in YAML.
The read-only Worker derives those fields from Release SPKs. Put one uploaded
SPK per disjoint set of DSM architectures in the same Release, with matching
package/version/displayname/description/firmware/dependency fields. Missing SPKs,
malformed INFO, shared metadata disagreement, ambiguous architectures or duplicate
package identities hide the affected package. Other packages remain available.

The initial listing intentionally exposes only Syno Reclaim. Connect remains
unlisted pending an explicit listing decision. Releases and permissions must be
ready before activating an entry; latest does not select prereleases or drafts.
