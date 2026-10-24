#!/usr/bin/env python3
"""Local catalog admission gate; never extracts or executes SPK contents."""
import argparse
import configparser
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import tempfile

import yaml


def read_member(archive, name):
    matches = [m for m in archive.getmembers() if m.name.removeprefix("./") == name]
    if len(matches) != 1 or not matches[0].isfile() or matches[0].size > 1024 * 1024:
        raise ValueError(f"missing, duplicate or unreadable {name}")
    with archive.extractfile(matches[0]) as stream:
        return stream.read().decode("utf-8")


def protocols(value):
    values = {"tcp", "udp"} if value == "both" else set(value.split(","))
    if not values or not values <= {"tcp", "udp"}:
        raise ValueError(f"invalid port protocol: {value}")
    return values


def port_number(value):
    if type(value) is not int or not 1 <= value <= 65535:
        raise ValueError(f"invalid port number: {value}")
    return value


def service_ports(text):
    config = configparser.ConfigParser(interpolation=None)
    config.read_string(text)
    if not config.sections():
        raise ValueError("empty port-config protocol-file")
    result = set()
    for name in config.sections():
        section = config[name]
        if "dst.ports" not in section:
            raise ValueError(f"missing dst.ports in {name}")
        for key in ("src.ports", "dst.ports"):
            if key not in section:
                continue
            value = section[key].strip().strip('"')
            numbers, _, proto = value.partition("/")
            for span in numbers.split(","):
                if not re.fullmatch(r"\d+(?::\d+)?", span):
                    raise ValueError(f"invalid port range: {span}")
                bounds = [port_number(int(n)) for n in span.split(":")]
                if bounds[0] > bounds[-1]:
                    raise ValueError(f"reversed port range: {span}")
                result.update((p, n) for p in protocols(proto or "both")
                              for n in range(bounds[0], bounds[-1] + 1))
    return result


def has_member(archive, name):
    return any(m.name.removeprefix("./") == name for m in archive.getmembers())


def inspect_spk(path):
    """Return INFO, declared ports and whether the SPK has a conf/resource."""
    with tarfile.open(path) as archive:
        info = dict(re.findall(r'^([\w]+)="([^"\n]*)"$', read_member(archive, "INFO"), re.M))
        if not all(info.get(k) for k in ("package", "version", "arch")):
            raise ValueError("missing INFO package/version/arch")
        # Native packages without conf/resource declare no DSM-managed ports.
        if not has_member(archive, "conf/resource"):
            return info, set(), False
        resource = json.loads(read_member(archive, "conf/resource"))
        result = set()
        nginx = resource.get("web-config", {}).get("nginx-static-config", {})
        for timing in ("enable", "disable"):
            entries = nginx.get(timing, [])
            if not isinstance(entries, list):
                raise ValueError(f"invalid web-config {timing} list")
            for entry in entries:
                listeners = entry.get("ports", [])
                if not isinstance(listeners, list):
                    raise ValueError("invalid web-config ports list")
                for listener in listeners:
                    result.update((p, port_number(listener["port"]))
                                  for p in protocols(listener["protocol"]))
        if "port-config" in resource:
            name = resource["port-config"]["protocol-file"]
            if not isinstance(name, str) or not name or ".." in PurePosixPath(name).parts or name.startswith("/"):
                raise ValueError("invalid port-config protocol-file path")
            # protocol-file is relative to the installed target, i.e. package.tgz.
            payloads = [m for m in archive.getmembers() if m.name.removeprefix("./") == "package.tgz"]
            if len(payloads) != 1 or not payloads[0].isfile():
                raise ValueError("unreadable package.tgz")
            with archive.extractfile(payloads[0]) as stream, tarfile.open(fileobj=stream) as target:
                result.update(service_ports(read_member(target, name.removeprefix("./"))))
        return info, result, True


def check_spks(paths, pins):
    wanted = {p["sha256"]: p for p in pins}
    found, owners, inventory, skipped = set(), {}, {}, []
    for path in sorted(paths):
        with open(path, "rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest not in wanted or digest in found:
            continue
        pin = wanted[digest]
        try:
            info, ports, declared = inspect_spk(path)
            if (path.stat().st_size != pin["size"] or info["package"] != pin["package"]
                    or info["version"] != pin["version"] or set(info["arch"].split()) != set(pin["arch"])):
                raise ValueError("SPK identity/size differs from pin")
        except (OSError, ValueError, KeyError, TypeError, AttributeError, tarfile.TarError,
                configparser.Error) as error:
            raise ValueError(f'{pin["package"]} {pin["version"]}: {error}') from error
        found.add(digest)
        package = info["package"]
        if not declared:
            skipped.append((package, info["version"]))
        inventory.setdefault(package, set()).update(ports)
        for port in ports:
            owners.setdefault(port, set()).add(package)
    missing = [f'{wanted[d]["package"]} {d}' for d in sorted(wanted.keys() - found)]
    if missing:
        raise ValueError("missing or changed pinned SPKs: " + ", ".join(missing))
    if not wanted:
        raise ValueError("no active pinned SPKs to check")
    return {
        "ok": all(len(names) == 1 for names in owners.values()),
        "artifacts": len(found),
        "packages": {name: [{"protocol": p, "port": n} for p, n in sorted(ports)]
                     for name, ports in sorted(inventory.items())},
        "conflicts": [{"protocol": p, "port": n, "packages": sorted(names)}
                      for (p, n), names in sorted(owners.items()) if len(names) > 1],
        "skipped": [{"package": name, "version": version, "reason": "no conf/resource"}
                    for name, version in sorted(set(skipped))],
    }


def active_entries(catalog):
    return [entry for entry in catalog["packages"]
            if entry.get("listed", True)
            and not catalog.get("publishers", {}).get(entry["publisher"], {}).get("blocked", False)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("catalog.yaml"))
    parser.add_argument("--spk-dir", type=Path, help="offline directory containing every active pinned SPK")
    args = parser.parse_args()
    try:
        entries = active_entries(yaml.safe_load(args.catalog.read_text()))
        pins = [pin for entry in entries for pin in entry.get("pins", [])
                if pin["version"] not in entry.get("blocked_versions", [])]
        with tempfile.TemporaryDirectory(prefix="catalog-ports-") as scratch:
            directory = args.spk_dir or Path(scratch)
            if not args.spk_dir:
                for index, entry in enumerate(entries):
                    if not any(p in pins for p in entry.get("pins", [])):
                        continue
                    source = entry["source"]
                    if source["kind"] != "github-release":
                        raise ValueError("non-GitHub sources require --spk-dir")
                    command = ["gh", "release", "download", "--repo", source["repo"],
                               "--pattern", "*.spk", "--dir", str(directory / str(index))]
                    if source["release"] != "latest":
                        command.append(source["release"])
                    # gh owns authentication; never copy credentials into command arguments.
                    try:
                        subprocess.run(command, check=True, capture_output=True, timeout=180)
                    except subprocess.SubprocessError as error:
                        raise ValueError(f'SPK download failed for {source["repo"]} '
                                         f'{source["release"]}; check gh authentication/release access') from error
            result = check_spks(directory.rglob("*.spk"), pins)
        print(json.dumps(result, indent=2))
        return 0 if result["ok"] else 1
    except (OSError, ValueError, KeyError, TypeError, AttributeError, yaml.YAMLError) as error:
        print(f"Port check failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
