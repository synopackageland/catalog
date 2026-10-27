#!/usr/bin/env python3
"""Validate catalog maintainer/distributor attribution without downloading SPKs."""
import argparse
from pathlib import Path
import re
from urllib.parse import urlsplit

import yaml

OWN_APPS = {"SynoReclaim", "SynoPkgConnect", "SynoPkgGopeed"}
SITE = "https://synopkgland.com/"


def validate(catalog):
    for entry in catalog["packages"]:
        metadata = entry.get("metadata", {})
        for field in ("maintainer", "distributor"):
            if field in metadata:
                value = metadata[field]
                if (not isinstance(value, str) or not value.strip() or len(value) > 80
                        or re.search(r"[\x00-\x1f\x7f]", value)):
                    raise ValueError(f"metadata.{field} must be one line of at most 80 characters")
        for field in ("maintainer_url", "distributor_url"):
            if field in metadata:
                value = metadata[field]
                if not isinstance(value, str) or len(value) > 2048:
                    raise ValueError(f"invalid metadata.{field}")
                url = urlsplit(value)
                if url.scheme not in ("https", "http") or not url.netloc or url.username or url.password:
                    raise ValueError(f"invalid metadata.{field}")
        if entry.get("publisher") != "synopackageland" or not metadata.get("upstream"):
            continue
        pins = entry.get("pins", [])
        if pins and all(pin["package"] in OWN_APPS for pin in pins):
            continue
        name = metadata.get("maintainer", "")
        if not name or re.fullmatch(r"syno\s*package\s*land", name.strip(), re.I):
            raise ValueError("upstream Apps must name the upstream owner as metadata.maintainer")
        if metadata.get("maintainer_url") != metadata["upstream"]["url"]:
            raise ValueError("upstream Apps must link maintainer_url to the upstream repository")
        if metadata.get("distributor") != "Syno Package Land" or metadata.get("distributor_url") != SITE:
            raise ValueError("upstream Apps must name Syno Package Land as distributor")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("catalog.yaml"))
    args = parser.parse_args()
    validate(yaml.safe_load(args.catalog.read_text()))
    print("Catalog attribution check passed")


if __name__ == "__main__":
    main()
