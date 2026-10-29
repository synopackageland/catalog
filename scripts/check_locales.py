#!/usr/bin/env python3
"""Require every website language for first-party App descriptions and changelogs.

The website shows metadata.description, long_description and changelog in the
visitor's language and falls back to English when a language is missing. For
Syno Package Land's own listings, a release that adds an English text without
the other languages fails here instead of silently showing English.
"""
import argparse
from pathlib import Path

import yaml

# The languages synopkgland.com is published in (website/src/i18n/locales.json).
LANGUAGES = ("en", "zh-TW", "zh-CN", "de", "fr", "ja", "ko")
FIELDS = ("description", "long_description", "changelog")


def problems(catalog):
    found = []
    for entry in catalog["packages"]:
        if entry.get("publisher") != "synopackageland":
            continue
        name = entry["pins"][0]["package"] if entry.get("pins") else entry.get("source", {}).get("repo", "?")
        metadata = entry.get("metadata", {})
        for field in FIELDS:
            value = metadata.get(field)
            if value is None:
                continue
            if not isinstance(value, dict):
                found.append(f"{name}: metadata.{field} must list every language ({', '.join(LANGUAGES)})")
                continue
            missing = [lang for lang in LANGUAGES if not isinstance(value.get(lang), str) or not value[lang].strip()]
            if missing:
                found.append(f"{name}: metadata.{field} is missing {', '.join(missing)}")
            copied = [lang for lang in LANGUAGES[1:] if lang not in missing and value[lang] == value.get("en")]
            if copied:
                found.append(f"{name}: metadata.{field} repeats the English text for {', '.join(copied)}")
    return found


def validate(catalog):
    found = problems(catalog)
    if found:
        raise ValueError("\n".join(found))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("catalog.yaml"))
    args = parser.parse_args()
    validate(yaml.safe_load(args.catalog.read_text()))
    print("Catalog language check passed")


if __name__ == "__main__":
    main()
