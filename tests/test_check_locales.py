import copy
import importlib.util
from pathlib import Path
import unittest

import yaml

spec = importlib.util.spec_from_file_location("check_locales", Path(__file__).parents[1] / "scripts/check_locales.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

TEXT = {"en": "Organize files", "zh-TW": "整理檔案", "zh-CN": "整理文件", "de": "Dateien ordnen",
        "fr": "Rangez vos fichiers", "ja": "ファイルを整理", "ko": "파일 정리"}


class LocaleTests(unittest.TestCase):
    def fixture(self, publisher="synopackageland"):
        return {"packages": [{"publisher": publisher, "pins": [{"package": "App"}], "metadata": {
            "description": dict(TEXT), "long_description": dict(TEXT), "changelog": dict(TEXT),
        }}]}

    def test_every_language_passes(self):
        module.validate(self.fixture())

    def test_missing_or_empty_language_fails(self):
        for field in module.FIELDS:
            for lang in module.LANGUAGES:
                for change in ("drop", "empty"):
                    with self.subTest(field=field, lang=lang, change=change):
                        c = copy.deepcopy(self.fixture())
                        if change == "drop":
                            del c["packages"][0]["metadata"][field][lang]
                        else:
                            c["packages"][0]["metadata"][field][lang] = " "
                        with self.assertRaisesRegex(ValueError, f"App: metadata.{field} is missing .*{lang}"):
                            module.validate(c)

    def test_plain_text_and_copied_english_fail(self):
        c = self.fixture()
        c["packages"][0]["metadata"]["changelog"] = "Only English"
        with self.assertRaisesRegex(ValueError, "must list every language"):
            module.validate(c)
        c = self.fixture()
        c["packages"][0]["metadata"]["description"]["ja"] = TEXT["en"]
        with self.assertRaisesRegex(ValueError, "repeats the English text for ja"):
            module.validate(c)

    def test_community_listings_are_not_required_to_translate(self):
        c = self.fixture("someone-else")
        c["packages"][0]["metadata"]["description"] = "Only English"
        module.validate(c)

    def test_catalog_passes(self):
        module.validate(yaml.safe_load((Path(__file__).parents[1] / "catalog.yaml").read_text()))


if __name__ == "__main__":
    unittest.main()
