# Continuous integration

Checks use standard GitHub-hosted Linux runners, read-only repository permissions and ordinary pull requests. No secrets are needed.

The fast workflow reuses native checks and skips product checks when only workflow or documentation files change. Full release matrices, Docker runtime compatibility, package installation and publication remain manual release gates. Green fast CI does not certify a release.

Existing automation is preserved as `*.disabled` files. These include inherited release, bot, privileged-event or matrix workflows and are intentionally inactive. Restore only after reviewing credentials, runner requirements and release scope.

The current migration validates workflow syntax and runner routing; its product checks are not selected. Product checks run on later source changes. Actions availability is managed separately; this PR does not enable disabled Actions.
