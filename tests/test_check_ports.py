import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_ports import active_entries, check_spks


def tar_bytes(files):
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode="w:gz") as archive:
        for name, content in files.items():
            if isinstance(content, str):
                content = content.encode()
            member = tarfile.TarInfo(name)
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))
    return data.getvalue()


def web(port, protocol="tcp", timing="enable"):
    return {"web-config": {"nginx-static-config": {
        timing: [{"ports": [{"port": port, "protocol": protocol}]}]}}}


class PortCheckTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.paths, self.pins = [], []

    def spk(self, package, resource, arch="x86_64", files=None):
        content = {"INFO": f'package="{package}"\nversion="1.0"\narch="{arch}"\n'}
        if resource is not None:
            content["conf/resource"] = json.dumps(resource)
        content.update(files or {})
        data = tar_bytes(content)
        path = Path(self.temp.name) / f"{len(self.paths)}.spk"
        path.write_bytes(data)
        self.paths.append(path)
        self.pins.append({"package": package, "version": "1.0", "arch": arch.split(),
                          "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)})
        return path

    def check(self):
        return check_spks(self.paths, self.pins)

    def test_duplicate_web_ports(self):
        self.spk("AppOne", web(29443))
        self.spk("AppTwo", web(29443, timing="disable"))
        self.assertEqual(self.check()["conflicts"], [
            {"protocol": "tcp", "port": 29443, "packages": ["AppOne", "AppTwo"]}])

    def test_distinct_and_transport_specific_ports(self):
        self.spk("AppOne", web(31443))
        self.spk("AppTwo", web(33443))
        self.spk("AppThree", web(31443, "udp"))
        self.spk("NoPorts", {})
        self.assertTrue(self.check()["ok"])

    def test_same_package_architectures_and_declarations_are_not_conflicts(self):
        resource = web(31443)
        resource["port-config"] = {"protocol-file": "ports/app.sc"}
        self.spk("AppOne", resource, files={"package.tgz": tar_bytes({
            "./ports/app.sc": '[app]\ndst.ports="31443/tcp"'})})
        self.spk("AppOne", web(31443), arch="armv8")
        result = self.check()
        self.assertTrue(result["ok"])
        self.assertEqual(result["artifacts"], 2)

    def test_port_config_ranges_defaults_and_web_both(self):
        self.spk("AppOne", {"port-config": {"protocol-file": "ports/app.sc"}}, files={
            "package.tgz": tar_bytes({"ports/app.sc":
                '[app]\nsrc.ports="31000/udp"\ndst.ports="31442:31443,33443"'})})
        self.spk("AppTwo", web(31443, "both"))
        self.assertEqual([c["protocol"] for c in self.check()["conflicts"]], ["tcp", "udp"])
        self.assertIn({"protocol": "udp", "port": 31000}, self.check()["packages"]["AppOne"])

    def test_all_architectures_are_compared(self):
        self.spk("AppOne", web(31443))
        self.spk("AppOne", web(33443), arch="armv8")
        self.spk("AppTwo", web(33443))
        self.assertFalse(self.check()["ok"])

    def test_missing_and_invalid_resource_fail_closed(self):
        for resource in (None, [], {"web-config": None},
                         {"web-config": {"nginx-static-config": {"enable": {}}}},
                         {"web-config": {"nginx-static-config": {"enable": [{"ports": {}}]}}}):
            with self.subTest(resource=resource):
                self.paths, self.pins = [], []
                self.spk("AppOne", resource)
                with self.assertRaisesRegex(ValueError, "AppOne"):
                    self.check()

    def test_missing_protocol_file_fails_closed(self):
        self.spk("AppOne", {"port-config": {"protocol-file": "ports/app.sc"}}, files={
            "package.tgz": tar_bytes({"other": ""})})
        with self.assertRaisesRegex(ValueError, "unreadable ports/app.sc"):
            self.check()

    def test_invalid_resource_json_and_unreadable_protocol_payload_fail(self):
        cases = [({}, {"conf/resource": "{broken"}),
                 ({"port-config": {"protocol-file": "app.sc"}}, {"package.tgz": b"not a tar"}),
                 ({"port-config": {"protocol-file": "app.sc"}}, {
                     "package.tgz": tar_bytes({"app.sc": '[app]\ndst.ports="33443:31443/tcp"'})})]
        for resource, files in cases:
            with self.subTest(files=list(files)):
                self.paths, self.pins = [], []
                self.spk("AppOne", resource, files=files)
                with self.assertRaisesRegex(ValueError, "AppOne"):
                    self.check()

    def test_empty_input_cannot_pass(self):
        with self.assertRaisesRegex(ValueError, "no active pinned SPKs"):
            self.check()

    def test_malformed_port_declarations_fail(self):
        for resource in (web(True), web(0), web(65536), web("31443"), web(31443, "sctp"),
                         {"port-config": {}}, {"port-config": {"protocol-file": "../ports"}}):
            with self.subTest(resource=resource):
                self.paths, self.pins = [], []
                self.spk("AppOne", resource)
                with self.assertRaises(ValueError):
                    self.check()

    def test_missing_or_changed_artifact_fails(self):
        path = self.spk("AppOne", web(31443))
        path.write_bytes(path.read_bytes() + b"changed")
        with self.assertRaisesRegex(ValueError, "missing or changed"):
            self.check()

    def test_pin_identity_must_match(self):
        self.spk("AppOne", web(31443))
        self.pins[0]["package"] = "OtherApp"
        with self.assertRaisesRegex(ValueError, "identity/size"):
            self.check()

    def test_hidden_and_blocked_publishers_are_excluded(self):
        self.assertEqual(active_entries({"publishers": {"blocked": {"blocked": True}}, "packages": [
            {"publisher": "ok"}, {"publisher": "ok", "listed": False},
            {"publisher": "blocked"}]}), [{"publisher": "ok"}])

    def test_cli_exit_codes(self):
        import yaml
        self.spk("AppOne", web(31443))
        self.spk("AppTwo", web(31443))
        catalog = Path(self.temp.name) / "catalog.yaml"
        catalog.write_text(yaml.safe_dump({"packages": [{"publisher": "example", "pins": self.pins}]}))
        command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/check_ports.py"),
                   "--catalog", str(catalog), "--spk-dir", self.temp.name]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertFalse(json.loads(result.stdout)["ok"])
        self.paths[-1].unlink()
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("missing or changed", result.stderr)
        catalog.write_text(yaml.safe_dump({"packages": [{"publisher": "example", "pins": self.pins[:1]}]}))
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
