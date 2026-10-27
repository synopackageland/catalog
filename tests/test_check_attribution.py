import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("check_attribution", Path(__file__).parents[1] / "scripts/check_attribution.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AttributionTests(unittest.TestCase):
    def fixture(self):
        return {"packages": [{"publisher": "synopackageland", "pins": [{"package": "UpstreamApp"}], "metadata": {
            "upstream": {"name": "App", "url": "https://github.com/example/app"},
            "maintainer": "Upstream Team", "maintainer_url": "https://github.com/example/app",
            "distributor": "Syno Package Land", "distributor_url": module.SITE,
        }}]}

    def test_upstream_attribution(self):
        module.validate(self.fixture())
        for field, value in [("maintainer", "Syno Package Land"), ("maintainer", "synopackageland"),
                             ("maintainer", ""), ("maintainer", "A\nB"), ("maintainer_url", "javascript:alert(1)"),
                             ("maintainer_url", module.SITE), ("distributor", "Other"),
                             ("distributor_url", "https://example.com")]:
            with self.subTest(field=field, value=value):
                c = copy.deepcopy(self.fixture())
                c["packages"][0]["metadata"][field] = value
                with self.assertRaises(ValueError):
                    module.validate(c)
        for field in ("maintainer", "maintainer_url", "distributor", "distributor_url"):
            c = self.fixture()
            del c["packages"][0]["metadata"][field]
            with self.assertRaises(ValueError):
                module.validate(c)

    def test_own_apps_may_include_upstream_software(self):
        for package in module.OWN_APPS:
            c = self.fixture()
            c["packages"][0]["pins"][0]["package"] = package
            c["packages"][0]["metadata"] = {"upstream": {"url": "https://github.com/example/app"},
                "maintainer": "Syno Package Land", "maintainer_url": module.SITE}
            module.validate(c)
