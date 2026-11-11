import copy
import importlib.util
from pathlib import Path
import unittest

import yaml

spec = importlib.util.spec_from_file_location("check_locales", Path(__file__).parents[1] / "scripts/check_locales.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

TEXT = {"en": "Organize files", "zh-TW": "整理檔案", "zh-CN": "整理文件", "de": "Dateien ordnen",
        "fr": "Rangez vos fichiers", "ja": "ファイルを整理", "ko": "파일 정리",
        "es": "Organiza archivos", "it": "Organizza i file"}


class LocaleTests(unittest.TestCase):
    def fixture(self):
        return {"schema": 4, "packages": [{"publisher": "synopackageland", "pins": [{"package": "App", "version": "1.0.0-0001"}], "metadata": {
            "description": dict(TEXT), "long_description": dict(TEXT),
            "changelog": {"releases": {"1.0.0-0001": {lang: [text] for lang, text in TEXT.items()}}},
        }}]}

    def test_every_language_passes(self):
        module.validate(self.fixture())

    def test_missing_or_empty_description_fails(self):
        for field in module.FIELDS:
            for lang in module.LANGUAGES:
                for change in ("drop", "empty"):
                    with self.subTest(field=field, lang=lang, change=change):
                        c = copy.deepcopy(self.fixture())
                        if change == "drop":
                            del c["packages"][0]["metadata"][field][lang]
                        else:
                            c["packages"][0]["metadata"][field][lang] = " "
                        with self.assertRaisesRegex(ValueError, f"App: metadata.{field}.{lang}"):
                            module.validate(c)
        c = self.fixture()
        del c["packages"][0]["metadata"]["description"]
        with self.assertRaisesRegex(ValueError, "must list every language"):
            module.validate(c)

    def test_all_historical_notes_require_nine_languages(self):
        for lang in module.LANGUAGES:
            for change in ("drop", "empty", "period"):
                c = self.fixture()
                notes = c["packages"][0]["metadata"]["changelog"]["releases"]["1.0.0-0001"]
                if change == "drop":
                    del notes[lang]
                else:
                    notes[lang] = [] if change == "empty" else [TEXT[lang] + "。"]
                with self.subTest(lang=lang, change=change), self.assertRaises(ValueError):
                    module.validate(c)

    def test_missing_pin_cannot_borrow_future_or_unrecorded_notes(self):
        c = self.fixture()
        history = c["packages"][0]["metadata"]["changelog"]
        history["releases"]["2.0.0-0002"] = history["releases"].pop("1.0.0-0001")
        history["unrecorded"] = [history["releases"]["2.0.0-0002"]]
        with self.assertRaisesRegex(ValueError, "pinned version 1.0.0-0001 has no changelog notes"):
            module.validate(c)

    def test_unrecorded_history_is_checked_too(self):
        c = self.fixture()
        history = c["packages"][0]["metadata"]["changelog"]
        history["unrecorded"] = [{lang: [text] for lang, text in TEXT.items()}]
        module.validate(c)
        del history["unrecorded"][0]["it"]
        with self.assertRaisesRegex(ValueError, r"unrecorded\[0\].it"):
            module.validate(c)

    def test_trailing_periods_and_copied_english_fail(self):
        for field in module.FIELDS:
            for ending in module.PERIODS:
                c = self.fixture()
                c["packages"][0]["metadata"][field]["en"] += ending + " "
                with self.subTest(field=field, ending=ending), self.assertRaisesRegex(ValueError, "trailing period"):
                    module.validate(c)
        c = self.fixture()
        c["packages"][0]["metadata"]["description"]["ja"] = TEXT["en"]
        with self.assertRaisesRegex(ValueError, "repeats the English text"):
            module.validate(c)

    def test_every_checked_publisher_is_required_to_translate(self):
        c = self.fixture()
        c["packages"][0]["publisher"] = "someone-else"
        c["packages"][0]["metadata"]["description"] = "Only English"
        with self.assertRaisesRegex(ValueError, "must list every language"):
            module.validate(c)

    def test_catalog_passes(self):
        module.validate(yaml.safe_load((Path(__file__).parents[1] / "catalog.yaml").read_text()))


if __name__ == "__main__":
    unittest.main()
