#!/usr/bin/env python3
"""Validate the catalog's sole store-text source, including every pinned release."""
import argparse
from pathlib import Path
import re

import yaml

# The languages published by the website and required by catalog schema 4.
LANGUAGES = ("en", "zh-TW", "zh-CN", "de", "fr", "ja", "ko", "es", "it")
FIELDS = ("description", "long_description")
PERIODS = ".。．｡"


def problems(catalog):
    found = []
    if catalog.get("schema") != 4:
        found.append("catalog.schema must be 4")

    def translations(name, path, value, notes=False):
        if not isinstance(value, dict):
            found.append(f"{name}: {path} must list every language ({', '.join(LANGUAGES)})")
            return
        for language in value.keys() - set(LANGUAGES):
            found.append(f"{name}: {path}.{language} is an unknown language")
        for language in LANGUAGES:
            text = value.get(language)
            here = f"{name}: {path}.{language}"
            if notes and (not isinstance(text, list) or not text or len(text) > 128):
                found.append(f"{here} must be a nonempty notes list")
                continue
            items = text if notes else [text]
            maximum = 1000 if path == "metadata.description" else 16000
            for item in items:
                if (not isinstance(item, str) or not item.strip() or len(item) > maximum
                        or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", item)):
                    found.append(f"{here} requires nonempty text of at most {maximum} characters")
                elif item.rstrip().endswith(tuple(PERIODS)):
                    found.append(f"{here} has a trailing period")
            if language != "en" and text is not None and text == value.get("en"):
                found.append(f"{here} repeats the English text")

    for entry in catalog["packages"]:
        name = entry["pins"][0]["package"] if entry.get("pins") else entry.get("source", {}).get("repo", "?")
        metadata = entry.get("metadata", {})
        for field in FIELDS:
            translations(name, f"metadata.{field}", metadata.get(field))
        history = metadata.get("changelog")
        if not isinstance(history, dict) or not isinstance(history.get("releases"), dict):
            found.append(f"{name}: metadata.changelog.releases must contain version records")
            continue
        for key in history.keys() - {"releases", "unrecorded"}:
            found.append(f"{name}: metadata.changelog.{key} is an unknown field")
        releases = history["releases"]
        if len(releases) > 256:
            found.append(f"{name}: too many changelog releases")
        for version, notes in releases.items():
            if not isinstance(version, str) or not re.fullmatch(r"[A-Za-z0-9_.+~-]+-\d+", version):
                found.append(f"{name}: invalid changelog SPK version {version}")
            translations(name, f"metadata.changelog.releases.{version}", notes, True)
        unrecorded = history.get("unrecorded", [])
        if not isinstance(unrecorded, list) or len(unrecorded) > 256:
            found.append(f"{name}: metadata.changelog.unrecorded must be a list")
        else:
            for index, notes in enumerate(unrecorded):
                translations(name, f"metadata.changelog.unrecorded[{index}]", notes, True)
            if not releases and not unrecorded:
                found.append(f"{name}: metadata.changelog history is empty")
        for version in {pin["version"] for pin in entry.get("pins", [])}:
            if version not in releases:
                found.append(f"{name}: pinned version {version} has no changelog notes")
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
    print("Catalog text check passed: nine languages, no trailing periods, pinned-version notes")


if __name__ == "__main__":
    main()
