#!/usr/bin/env node
// Generated from synopackageland/syno-package-land. MIT; see community-check-NOTICE.md. Do not edit.

// scripts/catalog/check-community.mts
import { readdirSync, readFileSync, lstatSync } from "node:fs";
import { join } from "node:path";

// packages/package-source/src/catalog-schema.ts
import { parseDocument } from "yaml";

// packages/package-source/src/app-facts.ts
var APP_INFO_ENUMS = {
  /** Full system access (root): none, only fixed actions after an administrator approves, or required. */
  root_access: ["none", "approval", "required"],
  /** Installed directly on the NAS, or run inside Container Manager. */
  runs: ["native", "container"],
  /** Administrators only, accounts an administrator selects (Application Privileges), or every NAS account. */
  access: ["admins", "selected", "everyone"],
  /** Signs in with the NAS account, its own accounts, or no sign-in. */
  account: ["dsm", "own", "none"],
  /** Keeps running in the background after the NAS starts. */
  background: ["yes", "no"],
  /** Opens as a DSM window, on its own web page, or has no screen. */
  opens: ["dsm", "web", "none"],
  internet: ["required", "optional", "none"],
  telemetry: ["none", "opt-in", "on"]
};
var DERIVED_KEYS = ["root_access", "runs", "access", "account", "background", "opens"];
var SDK_BACKENDS = ["go", "rust", "python", "node", "binary", "compose"];
var PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
var SHARE_NAME = /^[^\x00-\x1f\x7f/\\:*?"<>|]{1,64}$/;
var oneOf = (field, values) => `${field} must be one of ${values.join(", ")}`;
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function validateFacts(raw) {
  if (!record(raw)) throw new Error("facts must be a mapping");
  const lists = ["requires", "conflicts", "shared_folders"];
  for (const [k, v] of Object.entries(raw)) {
    if (k === "built_with") {
      if (v !== "sdk" && v !== "other") throw new Error(oneOf("facts.built_with", ["sdk", "other"]));
    } else if (k === "sdk_backend") {
      if (!SDK_BACKENDS.includes(v)) throw new Error(oneOf("facts.sdk_backend", SDK_BACKENDS));
    } else if (DERIVED_KEYS.includes(k)) {
      const values = APP_INFO_ENUMS[k];
      if (!values.includes(v)) throw new Error(oneOf(`facts.${k}`, values));
    } else if (k === "web_port") {
      if (!Number.isSafeInteger(v) || v < 1 || v > 65535)
        throw new Error("facts.web_port must be a port number");
    } else if (lists.includes(k)) {
      const pattern = k === "shared_folders" ? SHARE_NAME : PACKAGE_NAME;
      if (!Array.isArray(v) || v.length > 32 || !v.every((x) => typeof x === "string" && pattern.test(x)))
        throw new Error(`facts.${k} must be a list of names`);
    } else if (k === "signed" || k === "ctl") {
      if (typeof v !== "boolean") throw new Error(`facts.${k} must be true or false`);
    } else throw new Error(`facts.${k} is not a known field`);
  }
  if (raw.built_with === void 0) throw new Error("facts.built_with is required");
  if (raw.sdk_backend !== void 0 && raw.built_with !== "sdk")
    throw new Error("facts.sdk_backend needs built_with: sdk");
  return raw;
}
function validateDeclared(key, value) {
  if (!(key in APP_INFO_ENUMS)) return false;
  const values = ["unknown", ...APP_INFO_ENUMS[key]];
  if (typeof value !== "string" || !values.includes(value))
    throw new Error(oneOf(`metadata.${key}`, values));
  return true;
}
var FACT_FILES = ["conf/privilege", "conf/resource", "sdk-package.json"];
function json(files, name) {
  if (files[name] === void 0) return void 0;
  let v;
  try {
    v = JSON.parse(files[name]);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
  if (!record(v)) throw new Error(`${name} is not a JSON object`);
  return v;
}
var packageNames = (value) => (value ?? "").split(":").map((p) => /^[A-Za-z][A-Za-z0-9_.-]*/.exec(p.trim())?.[0]).filter((p) => !!p && PACKAGE_NAME.test(p)).slice(0, 32);
var ELEVATED = /* @__PURE__ */ new Set(["root", "system"]);
function deriveFacts({ info, files, names: names2 }) {
  const privilege = json(files, "conf/privilege");
  const resource = json(files, "conf/resource") ?? {};
  const marker = json(files, "sdk-package.json");
  const compose = !marker && names2.has("privilege") && "docker-project" in resource;
  const builtWithSdk = !!marker || names2.has("native-layout.json") || compose;
  const requires = packageNames(info.install_dep_packages);
  const container = "docker-project" in resource || "docker" in resource || requires.some((p) => p === "ContainerManager" || p === "Docker");
  const capabilities = Array.isArray(marker?.capabilities) ? marker.capabilities : [];
  const executor = !!info.synopkgland_executor_sha256 || capabilities.includes("rootOps") || capabilities.includes("delegate");
  const runsAsRoot = !!privilege && (ELEVATED.has(privilege.defaults?.["run-as"]) || ["ctrl-script", "executable", "tool"].some(
    (k) => Array.isArray(privilege[k]) && privilege[k].some((e) => ELEVATED.has(e?.["run-as"]))
  ));
  const nativeSdk = builtWithSdk && !compose;
  const facts = {
    built_with: builtWithSdk ? "sdk" : "other",
    ...marker && SDK_BACKENDS.includes(marker.backend) ? { sdk_backend: marker.backend } : compose ? { sdk_backend: "compose" } : {},
    ...runsAsRoot ? { root_access: "required" } : nativeSdk && privilege ? { root_access: executor ? "approval" : "none" } : {},
    runs: container ? "container" : "native",
    ...marker?.entry === "admin-only" ? { access: "admins" } : marker?.entry === "app-privilege" ? { access: "selected" } : {},
    ...nativeSdk && info.dsmuidir ? { account: "dsm" } : {},
    ..."systemd-user-unit" in resource || container || capabilities.includes("jobs") || capabilities.includes("delegate") ? { background: "yes" } : {},
    ...info.dsmuidir ? { opens: "dsm" } : info.adminport || info.adminurl ? { opens: "web" } : {},
    .../^\d{1,5}$/.test(info.adminport ?? "") && +info.adminport >= 1 && +info.adminport <= 65535 && !info.dsmuidir ? { web_port: +info.adminport } : {},
    requires,
    conflicts: packageNames(info.install_conflict_packages),
    shared_folders: (Array.isArray(resource["data-share"]?.shares) ? resource["data-share"].shares : []).map((s) => s?.name).filter((n) => typeof n === "string" && SHARE_NAME.test(n)).slice(0, 32),
    signed: names2.has("syno_signature.asc"),
    // Only a ctl description in the SDK marker tells; a wrapper may implement the contract outside it.
    ...record(marker?.ctl) ? { ctl: true } : {}
  };
  return validateFacts(facts);
}
function contradictions(derived, declared) {
  if (!derived || !declared) return [];
  return DERIVED_KEYS.flatMap((k) => {
    const shown = derived[k], said = declared[k];
    return shown && said && said !== "unknown" && said !== shown ? [`metadata.${k} says ${said}, but the package shows ${shown}`] : [];
  });
}

// packages/package-source/src/metadata.ts
function safeMetadataUrl(value, mail = false) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return !u.username && !u.password && (["https:", "http:"].includes(u.protocol) || mail && u.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.pathname));
  } catch {
    return false;
  }
}
var MAX_SCREENSHOTS = 5;
var MAX_CATALOG_SCREENSHOTS = 10;
var safeScreenshotUrl = (value) => safeMetadataUrl(value) && value.startsWith("https:");
var maxLength = (key) => key === "description" ? 1e3 : key === "privacy_note" ? 280 : 16e3;
var HTTPS_ONLY = ["privacy_url"];
var httpsUrl = (v) => safeMetadataUrl(v) && v.startsWith("https:");
var oneLine = (v, max) => typeof v === "string" && !!v.trim() && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
function validateUpstream(v) {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("metadata.upstream must be an object with name and url");
  for (const k of Object.keys(v))
    if (!["name", "url", "license"].includes(k))
      throw new Error(`metadata.upstream.${k} is not a known field`);
  const u = v;
  if (!oneLine(u.name, 80))
    throw new Error("metadata.upstream.name must be one line of at most 80 characters");
  if (!httpsUrl(u.url)) throw new Error("metadata.upstream.url must be an https:// URL");
  if (u.license !== void 0 && !oneLine(u.license, 80))
    throw new Error("metadata.upstream.license must be one line of at most 80 characters");
}
function validateMetadata(raw, maxScreenshots = MAX_SCREENSHOTS) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("invalid metadata");
  const allowed = [
    "description",
    "long_description",
    "changelog",
    "contact_email",
    "support_email",
    "homepage",
    "source_url",
    "issues_url",
    "license",
    "maintainer",
    "maintainer_url",
    "distributor",
    "distributor_url",
    "support_url",
    "helpurl",
    "screenshots",
    ...HTTPS_ONLY,
    "upstream",
    "privacy_note"
  ];
  for (const [k, v] of Object.entries(raw)) {
    if (validateDeclared(k, v)) continue;
    if (!allowed.includes(k)) throw new Error(`metadata.${k} is not a known field`);
    if (k === "maintainer" || k === "distributor") {
      if (!oneLine(v, 80)) throw new Error(`metadata.${k} must be one line of at most 80 characters`);
      continue;
    }
    if (k === "upstream") {
      validateUpstream(v);
      continue;
    }
    if (HTTPS_ONLY.includes(k)) {
      if (!httpsUrl(v))
        throw new Error(`metadata.${k} must be an https:// URL`);
      continue;
    }
    if (k === "privacy_note") {
      const texts = typeof v === "string" ? [v] : v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v) : [];
      if (!texts.length || Object.keys(texts).length > 32 || !texts.every((t) => {
        const [lang, value] = typeof t === "string" ? ["en", t] : t;
        return /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(lang) && typeof value === "string" && !!value.trim() && value.length <= 280 && !/[\x00-\x1f\x7f]/.test(value);
      }))
        throw new Error("metadata.privacy_note must be one line of at most 280 characters per language");
      continue;
    }
    if (k === "screenshots") {
      if (!Array.isArray(v) || v.length > maxScreenshots || !v.every(safeScreenshotUrl))
        throw new Error("invalid screenshots");
    } else if ((k === "description" || k === "long_description" || k === "changelog") && typeof v === "object" && v && !Array.isArray(v)) {
      if (Object.entries(v).length > 32 || !Object.entries(v).every(
        ([lang, t]) => /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(lang) && typeof t === "string" && t.length <= maxLength(k) && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t)
      ))
        throw new Error("invalid localized description");
    } else if (typeof v !== "string" || v.length > maxLength(k) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))
      throw new Error("invalid text");
    if (k.endsWith("_email") && (typeof v !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))
      throw new Error("invalid email");
    if ([
      "homepage",
      "source_url",
      "issues_url",
      "maintainer_url",
      "distributor_url",
      "support_url",
      "helpurl"
    ].includes(k) && !safeMetadataUrl(v, k === "support_url"))
      throw new Error("invalid metadata URL");
  }
  if (JSON.stringify(raw).length > 32e3) throw new Error("metadata too large");
  return raw;
}

// packages/package-source/src/dsm-platforms.ts
var DSM_PLATFORMS = {
  "x86_64": {
    "members": [
      "apollolake",
      "avoton",
      "braswell",
      "broadwell",
      "broadwellnk",
      "broadwellnkv2",
      "broadwellntb",
      "broadwellntbap",
      "bromolow",
      "cedarview",
      "coffeelake",
      "denverton",
      "epyc7002",
      "epyc7003",
      "epyc7003ntb",
      "geminilake",
      "geminilakenk",
      "grantley",
      "icelaked",
      "kvmcloud",
      "kvmx64",
      "purley",
      "r1000",
      "r1000nk",
      "skylaked",
      "v1000",
      "v1000nk"
    ],
    "platformOnly": []
  },
  "aarch64": {
    "members": [
      "armada37xx",
      "rtd1296",
      "rtd1619",
      "rtd1619b"
    ],
    "platformOnly": []
  },
  "armv7": {
    "members": [
      "alpine",
      "alpine4k"
    ],
    "platformOnly": [
      "armada38x",
      "monaco"
    ]
  }
};

// packages/package-source/src/index-manifest.ts
function parseOsMinVer(osMinVer) {
  const match = /^(\d+)\.(\d+)(?:\.\d+)?-(\d+)$/.exec(osMinVer);
  if (!match) {
    throw new Error(`invalid os_min_ver: ${osMinVer}`);
  }
  return { major: Number(match[1]), build: Number(match[3]) };
}
function parseOsMaxVer(osMaxVer) {
  return parseOsMinVer(osMaxVer);
}
var ARCH_ALIASES = {
  x64: "x86_64",
  amd64: "x86_64",
  arm64: "aarch64",
  armv8: "aarch64",
  evansport: "i686",
  "628x": "armv5",
  ...Object.fromEntries(
    Object.entries(DSM_PLATFORMS).flatMap(
      ([family, { members }]) => members.map((platform) => [platform, family])
    )
  )
};
var ARCH_FAMILIES = /* @__PURE__ */ new Set([
  "noarch",
  "x86_64",
  "i686",
  "armv7",
  "armv5",
  "aarch64",
  "x64",
  "amd64",
  "arm64",
  "armv8"
]);
var PLATFORM_ONLY_ARCHES = /* @__PURE__ */ new Set([
  "comcerto2k",
  "armada370",
  "armada375",
  "armadaxp",
  ...Object.values(DSM_PLATFORMS).flatMap(({ platformOnly }) => platformOnly)
]);
function isKnownArch(arch) {
  return ARCH_FAMILIES.has(arch) || PLATFORM_ONLY_ARCHES.has(arch) || Object.hasOwn(ARCH_ALIASES, arch);
}
function normalizeArch(arch) {
  return Object.hasOwn(ARCH_ALIASES, arch) ? ARCH_ALIASES[arch] : arch;
}

// packages/package-source/src/catalog-schema.ts
var record2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var slug = /^[a-z][a-z0-9-]{1,40}$/;
var email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var GITHUB_REPO = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
var RELEASE_TAG = /^[A-Za-z0-9][A-Za-z0-9._+~-]{0,127}$/;
var PACKAGE_VERSION = /^[A-Za-z0-9_.+~-]+-\d+$/;
var CATEGORY = /^[a-z][a-z0-9-]{0,40}$/;
var validArch = (arch) => Array.isArray(arch) && arch.length > 0 && arch.every((a) => typeof a === "string" && /^[A-Za-z0-9_]+$/.test(a)) && new Set(arch).size === arch.length;
function readYaml(text2) {
  const doc = parseDocument(text2, { uniqueKeys: true });
  if (doc.errors.length) throw new Error("invalid YAML");
  return doc.toJS({ maxAliasCount: 0 });
}
var official = {
  id: "synopackageland",
  display_name: "Syno Package Land",
  contact_email: "support@synopkgland.com",
  support_email: "support@synopkgland.com",
  verified: false
};
var only = (v, keys) => {
  const unknown = Object.keys(v).find((k) => !keys.includes(k));
  if (unknown !== void 0) throw new Error(`${unknown} is not a known field`);
};
function parseCatalogYaml(text2) {
  const raw = readYaml(text2);
  if (!record2(raw) || ![1, 2, 3].includes(raw.schema) || !Array.isArray(raw.packages) || raw.packages.length > (raw.schema === 3 ? 50 : 20))
    throw new Error("invalid schema");
  only(raw, ["schema", "publishers", "packages"]);
  const publishers = { synopackageland: official };
  const checkedFile = raw.schema === 3;
  if (raw.schema >= 2 && !record2(raw.publishers))
    throw new Error("missing publishers");
  for (const [id, p] of Object.entries(raw.publishers ?? {})) {
    if (!slug.test(id) || !record2(p)) throw new Error("invalid publisher");
    only(p, [
      "display_name",
      "contact_email",
      "support_email",
      "homepage",
      ...checkedFile ? [] : ["verified"],
      "blocked",
      "package_names"
    ]);
    const v = {
      ...id === "synopackageland" ? official : {},
      ...p,
      id
    };
    if (typeof v.display_name !== "string" || !v.display_name.trim() || v.display_name.length > 160 || !email.test(v.contact_email ?? "") || !email.test(v.support_email ?? ""))
      throw new Error("publisher contacts required");
    for (const k of ["verified", "blocked"])
      if (v[k] !== void 0 && typeof v[k] !== "boolean")
        throw new Error("invalid publisher switch");
    if (v.homepage !== void 0 && !safeMetadataUrl(v.homepage))
      throw new Error("invalid publisher homepage");
    if (v.package_names !== void 0 && (!Array.isArray(v.package_names) || !v.package_names.every(
      (p2) => typeof p2 === "string" && /^[A-Za-z][A-Za-z0-9_.-]{1,31}$/.test(p2)
    )))
      throw new Error("invalid reserved package names");
    publishers[id] = v;
  }
  const ids = /* @__PURE__ */ new Set();
  const selections = raw.packages.map((v) => {
    if (!record2(v)) throw new Error("invalid selection");
    only(v, [
      "repo",
      "release",
      "listed",
      "featured",
      "recommended",
      "category",
      "order",
      "publisher",
      ...checkedFile ? [] : ["trust"],
      "source",
      "pins",
      "metadata",
      "blocked_versions",
      "info"
    ]);
    const publisher = publishers[v.publisher ?? "synopackageland"];
    if (!publisher) throw new Error("unknown publisher");
    const trust = v.trust ?? (publisher.id === "synopackageland" ? "official" : checkedFile ? "verified" : "community");
    if (!["official", "verified", "community"].includes(trust) || trust === "official" && publisher.id !== "synopackageland")
      throw new Error("invalid trust tier");
    const source = v.source ?? {
      kind: "github-release",
      repo: v.repo,
      release: v.release,
      access: "private"
    };
    if (!record2(source)) throw new Error("invalid source");
    if (source.kind === "github-release") {
      only(source, ["kind", "repo", "release", "access", "credential_binding"]);
      if (typeof source.repo !== "string" || !GITHUB_REPO.test(source.repo) || typeof source.release !== "string" || !RELEASE_TAG.test(source.release))
        throw new Error("invalid GitHub source");
      if (raw.schema === 1 && !source.repo.startsWith("synopackageland/"))
        throw new Error("invalid legacy repo");
      source.access ??= publisher.id === "synopackageland" ? "private" : "public";
      if (!["private", "public"].includes(source.access))
        throw new Error("invalid access");
      if (source.credential_binding !== void 0 && !/^THIRD_PARTY_[A-Z0-9_]{1,60}$/.test(source.credential_binding))
        throw new Error("invalid credential binding");
      if (checkedFile && publisher.id !== "synopackageland" && source.access !== "public")
        throw new Error("third-party SPK must be public");
      if (source.access === "private" && publisher.id !== "synopackageland" && !source.credential_binding)
        throw new Error("private publisher needs separate binding");
      if (publisher.id === "synopackageland" && source.access === "private" && !source.repo.startsWith("synopackageland/"))
        throw new Error("official token scope");
    } else if (source.kind === "https") {
      only(source, ["kind", "assets"]);
      if (!Array.isArray(source.assets) || source.assets.length < 1 || source.assets.length > 8)
        throw new Error("invalid HTTPS assets");
      for (const a of source.assets) {
        if (!record2(a)) throw new Error("invalid HTTPS asset");
        only(a, ["url", "name"]);
        if (!safeSourceUrl(a.url) || typeof a.name !== "string" || !/^[A-Za-z0-9._-]+\.spk$/.test(a.name))
          throw new Error("unsafe HTTPS asset");
      }
    } else throw new Error("unsupported source");
    if (trust === "official" && (source.kind !== "github-release" || !source.repo.startsWith("synopackageland/")))
      throw new Error("official source must use our GitHub Releases");
    for (const k of ["listed", "featured"])
      if (v[k] !== void 0 && typeof v[k] !== "boolean")
        throw new Error("invalid switch");
    if (v.recommended !== void 0 && typeof v.recommended !== "boolean")
      throw new Error("recommended must be true or false");
    if (v.recommended && trust === "community")
      throw new Error("recommended needs the basic security check; this entry is community");
    if (v.category !== void 0 && (typeof v.category !== "string" || !CATEGORY.test(v.category)))
      throw new Error("invalid category");
    if (v.order !== void 0 && (!Number.isSafeInteger(v.order) || v.order < 0 || v.order > 1e4))
      throw new Error("invalid order");
    if (v.blocked_versions !== void 0 && (!Array.isArray(v.blocked_versions) || !v.blocked_versions.every((x) => typeof x === "string")))
      throw new Error("invalid blocklist");
    const pins = v.pins ?? [];
    if (!Array.isArray(pins) || pins.length > 64)
      throw new Error("invalid pins");
    const keys = /* @__PURE__ */ new Set();
    for (const p of pins) {
      if (!record2(p)) throw new Error("invalid pin");
      only(p, [
        "package",
        "version",
        "arch",
        "sha256",
        "md5",
        "size",
        "facts",
        "review"
      ]);
      if (typeof p.package !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{1,127}$/.test(p.package) || typeof p.version !== "string" || !PACKAGE_VERSION.test(p.version) || !validArch(p.arch) || !/^[a-f0-9]{64}$/.test(p.sha256) || !/^[a-f0-9]{32}$/.test(p.md5) || !Number.isSafeInteger(p.size) || p.size <= 0 || p.size > 512 * 1024 * 1024)
        throw new Error("invalid pin");
      if (p.facts !== void 0) validateFacts(p.facts);
      if (publisher.id !== "synopackageland" && !publisher.package_names?.includes(p.package))
        throw new Error("publisher namespace");
      const r = p.review;
      if (!record2(r)) throw new Error("missing pin audit");
      only(r, [
        "type",
        "reviewer",
        "reviewed_at",
        "source_ref",
        "source_repo",
        "report_sha256",
        "checklist"
      ]);
      if (r.type !== (trust === "community" ? "submitted" : "reviewed") || typeof r.reviewer !== "string" || !r.reviewer.trim() || r.reviewer.length > 160 || typeof r.reviewed_at !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(r.reviewed_at) || !Number.isFinite(Date.parse(r.reviewed_at)) || typeof r.source_ref !== "string" || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(r.source_ref) || r.report_sha256 !== void 0 && !/^[a-f0-9]{64}$/.test(r.report_sha256) || r.checklist !== void 0 && r.checklist !== "basic-v1")
        throw new Error("invalid review audit");
      if (r.source_repo !== void 0 && (typeof r.source_repo !== "string" || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r.source_repo)))
        throw new Error("invalid reviewed source repo");
      if (trust === "verified" && source.kind === "https" && !r.source_repo)
        throw new Error("verified HTTPS source needs reviewed GitHub repo");
      const key = p.package + ":" + p.version + ":" + [...p.arch].sort().join(",");
      if (keys.has(key)) throw new Error("duplicate pin");
      keys.add(key);
    }
    const metadata = v.metadata ? validateMetadata(v.metadata, MAX_CATALOG_SCREENSHOTS) : {};
    const ownApp = pins.length > 0 && pins.every((p) => ["SynoReclaim", "SynoPkgConnect", "SynoPkgGopeed"].includes(p.package));
    if (publisher.id === "synopackageland" && metadata.upstream && !ownApp) {
      if (!metadata.maintainer || /^syno\s*package\s*land$/i.test(metadata.maintainer.trim()))
        throw new Error("upstream Apps must name the upstream owner as metadata.maintainer");
      if (metadata.maintainer_url !== metadata.upstream.url)
        throw new Error("upstream Apps must link maintainer_url to the upstream repository");
      if (metadata.distributor !== "Syno Package Land" || metadata.distributor_url !== "https://synopkgland.com/")
        throw new Error("upstream Apps must name Syno Package Land as distributor");
    }
    for (const p of pins) {
      const found = contradictions(p.facts, metadata);
      if (found.length) throw new Error(`${p.package} ${p.version}: ${found.join("; ")}`);
    }
    const identity = JSON.stringify(source);
    if (ids.has(identity)) throw new Error("duplicate source");
    ids.add(identity);
    return {
      repo: source.kind === "github-release" ? source.repo : `${publisher.id}/external-${raw.packages.indexOf(v)}`,
      release: source.release ?? "external",
      source,
      publisher,
      trust,
      pins,
      blocked_versions: v.blocked_versions ?? [],
      metadata,
      ...v.info === void 0 ? {} : { info: parseInfo(v.info) },
      listed: v.listed ?? true,
      featured: v.featured ?? false,
      recommended: v.recommended ?? false,
      category: v.category ?? "utilities",
      order: v.order ?? 100
    };
  });
  const owners = /* @__PURE__ */ new Map();
  for (const publisher of Object.values(publishers))
    for (const name of publisher.package_names ?? []) {
      const key = name.toLowerCase();
      if (owners.has(key) && owners.get(key) !== publisher.id)
        throw new Error("namespace ownership conflict");
      owners.set(key, publisher.id);
    }
  for (const selection of selections)
    for (const pin of selection.pins) {
      const key = pin.package.toLowerCase();
      if (owners.has(key) && owners.get(key) !== selection.publisher.id)
        throw new Error("package ownership conflict");
      owners.set(key, selection.publisher.id);
    }
  return selections;
}
var text = (v, max) => typeof v === "string" && !!v.trim() && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
function parseInfo(v) {
  if (!record2(v)) throw new Error("invalid info");
  only(v, ["displayname", "description", "os_min_ver"]);
  if (!text(v.displayname, 80) || !text(v.description, 1e3) || typeof v.os_min_ver !== "string" || parseOsMinVer(v.os_min_ver).major < 7)
    throw new Error("invalid info");
  return {
    displayname: v.displayname,
    description: v.description,
    os_min_ver: v.os_min_ver
  };
}
function safeSourceUrl(value) {
  if (!safeMetadataUrl(value)) return false;
  const u = new URL(value);
  return u.protocol === "https:" && !u.port && u.hostname.includes(".") && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && !u.hostname.startsWith("[") && !/(?:^|\.)(?:localhost|local|internal|syno|test|invalid)$/.test(u.hostname);
}

// packages/package-source/src/github-source.ts
var JSON_LIMIT = 1024 * 1024;

// packages/package-source/src/spk-stream.ts
import { createHash } from "node:crypto";

// packages/package-source/src/tar.ts
var isRegularFile = (entry) => [0, 48].includes(entry.type);
async function walkTar(stream, maxExpanded, onEntry) {
  const reader = stream.getReader();
  let chunk = new Uint8Array(0), offset = 0, expanded = 0;
  async function take(n, keep) {
    const output = keep ? new Uint8Array(n) : new Uint8Array(0);
    let done = 0;
    while (done < n) {
      if (offset === chunk.length) {
        const next = await reader.read();
        if (next.done) throw new Error("truncated tar");
        chunk = next.value;
        offset = 0;
        expanded += chunk.length;
        if (expanded > maxExpanded) throw new Error("expanded tar too large");
      }
      const count = Math.min(n - done, chunk.length - offset);
      if (keep) output.set(chunk.subarray(offset, offset + count), done);
      offset += count;
      done += count;
    }
    return output;
  }
  const decode = (v) => new TextDecoder("utf-8", { fatal: true }).decode(v).replace(/\0.*$/s, "");
  let ended = false;
  try {
    for (let entries = 0; entries < 4096; entries++) {
      const h = await take(512, true);
      if (h.every((x) => x === 0)) {
        const end = await take(512, true);
        if (!end.every((x) => x === 0)) throw new Error("bad tar end");
        ended = true;
        break;
      }
      const number = (v) => {
        const s = decode(v).trim();
        if (!/^[0-7]+$/.test(s)) throw new Error("invalid tar number");
        return parseInt(s, 8);
      };
      const sum = h.reduce((s, v, i2) => s + (i2 >= 148 && i2 < 156 ? 32 : v), 0);
      if (sum !== number(h.subarray(148, 156))) throw new Error("tar checksum");
      let name = decode(h.subarray(0, 100));
      const prefix = decode(h.subarray(345, 500));
      if (prefix) name = `${prefix}/${name}`;
      name = name.replace(/^\.\//, "");
      const size = number(h.subarray(124, 136));
      if (!Number.isSafeInteger(size) || size > maxExpanded)
        throw new Error("tar member too large");
      const consume = onEntry({ name, type: h[156], size });
      const bytes = await take(size, !!consume);
      consume?.(bytes);
      await take((512 - size % 512) % 512, false);
    }
    if (!ended) throw new Error("missing tar end");
    if (chunk.subarray(offset).some((x) => x !== 0))
      throw new Error("trailing tar data");
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      expanded += v.value.length;
      if (expanded > maxExpanded || v.value.some((x) => x !== 0))
        throw new Error("trailing tar data");
    }
  } catch (error) {
    await reader.cancel().catch(() => {
    });
    throw error;
  }
}

// packages/package-source/src/spk-stream.ts
var MAX_SPK = 512 * 1024 * 1024;
var MAX_TAR = 600 * 1024 * 1024;
var MAX_ICON = 256 * 1024;
async function inspectSpkStream(body, expectedSize, options = {}) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > MAX_SPK)
    throw new Error("invalid size");
  const md5 = createHash("md5"), sha256 = createHash("sha256");
  let size = 0;
  const hashed = body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        size += chunk.length;
        if (size > expectedSize || size > MAX_SPK)
          throw new Error("asset exceeds size");
        md5.update(chunk);
        sha256.update(chunk);
        controller.enqueue(chunk);
      }
    })
  );
  const firstReader = hashed.getReader();
  const initial = [];
  let initialSize = 0;
  while (initialSize < 2) {
    const next = await firstReader.read();
    if (next.done) {
      await firstReader.cancel();
      throw new Error("empty archive");
    }
    initial.push(next.value);
    initialSize += next.value.length;
  }
  const signature = Buffer.concat(initial);
  const raw = new ReadableStream({
    start(c) {
      for (const part of initial) c.enqueue(part);
    },
    async pull(c) {
      const v = await firstReader.read();
      if (v.done) c.close();
      else c.enqueue(v.value);
    },
    cancel(reason) {
      return firstReader.cancel(reason);
    }
  });
  const stream = signature[0] === 31 && signature[1] === 139 ? raw.pipeThrough(new DecompressionStream("gzip")) : raw;
  let info, icons, payload = false;
  const names2 = /* @__PURE__ */ new Set(), files = {};
  await walkTar(stream, MAX_TAR, (entry) => {
    const { name, size: length } = entry;
    names2.add(name);
    if (options.facts && FACT_FILES.includes(name)) {
      if (!isRegularFile(entry) || length > 65536 || name in files)
        throw new Error(`${name} must be one regular file of at most 64 KiB`);
      return (bytes) => {
        files[name] = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      };
    }
    const selected = name === "INFO" || /^PACKAGE_ICON(?:_256)?\.PNG$/i.test(name);
    if (selected && !isRegularFile(entry))
      throw new Error("metadata must be a regular file");
    if (name === "INFO" && (info || length > 65536))
      throw new Error("duplicate or oversized INFO");
    if (selected && name !== "INFO" && length > MAX_ICON)
      throw new Error("icon too large");
    if (name === "package.tgz") {
      if (payload || length === 0 || !isRegularFile(entry))
        throw new Error("invalid payload");
      payload = true;
    }
    if (!selected) return void 0;
    return (bytes) => {
      if (name === "INFO") {
        info = parseInfo2(new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\0.*$/s, ""));
        return;
      }
      if (!Buffer.from(bytes.subarray(0, 8)).equals(
        Buffer.from("89504e470d0a1a0a", "hex")
      ))
        throw new Error("invalid PNG");
      icons = {
        ...icons,
        [/_256\./i.test(name) ? "256" : "64"]: {
          png: Buffer.from(bytes).toString("base64"),
          sha256: createHash("sha256").update(bytes).digest("hex")
        }
      };
    };
  });
  if (!info || !payload) throw new Error("missing archive metadata");
  if (size !== expectedSize) throw new Error("size mismatch");
  return {
    info,
    size,
    md5: md5.digest("hex"),
    sha256: sha256.digest("hex"),
    icons,
    ...options.facts ? { facts: deriveFacts({ info, files, names: names2 }) } : {}
  };
}
function parseInfo2(text2) {
  const info = /* @__PURE__ */ Object.create(null);
  for (const line of text2.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const m = /^([a-zA-Z_][a-zA-Z0-9_]*)=(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s"']*))\s*$/.exec(
      line
    );
    if (!m || Object.hasOwn(info, m[1]))
      throw new Error("invalid INFO assignment");
    info[m[1]] = m[2] !== void 0 ? m[2].replace(/\\(["\\$`])/g, "$1") : m[3] ?? m[4];
  }
  for (const key of [
    "package",
    "version",
    "displayname",
    "description",
    "arch",
    "os_min_ver"
  ])
    if (!info[key] || /[\x00-\x1f]/.test(info[key]))
      throw new Error("missing INFO field");
  if (!/^[A-Za-z][A-Za-z0-9_.-]{1,127}$/.test(info.package) || info.package.endsWith(".dev") || !/^[A-Za-z0-9_.+~-]+-\d+$/.test(info.version))
    throw new Error("invalid package identity");
  const arch = info.arch.split(/\s+/);
  if (!arch.every((a) => /^[a-zA-Z0-9_]+$/.test(a)) || new Set(arch).size !== arch.length || arch.includes("noarch") && arch.length !== 1)
    throw new Error("invalid arch");
  parseOsMinVer(info.os_min_ver);
  if (info.os_max_ver) parseOsMaxVer(info.os_max_ver);
  return info;
}

// packages/package-source/src/github-catalog.ts
var JSON_LIMIT2 = 1024 * 1024;
function addDisjointArch(seen, arch) {
  for (const normalized of new Set(arch.map(normalizeArch)))
    if (seen.has(normalized) || seen.has("noarch") || normalized === "noarch" && seen.size > 0)
      throw new Error("overlapping arch");
  for (const normalized of arch.map(normalizeArch)) seen.add(normalized);
}
var LAST_GOOD_TTL = 30 * 86400;

// packages/package-source/src/community.ts
var MAX_METADATA = 16 * 1024 * 1024;
var MAX_CATALOG_FILE = 1024 * 1024;
var MAX_FILE = 64 * 1024;
var MAX_SPK2 = 64 * 1024 * 1024;
var PER_PUBLISHER = 10;
var TOTAL = 200;
var ICON_PATH = /^[A-Za-z0-9_-][A-Za-z0-9._/-]{0,199}\.png$/;
var names = (v, pattern) => {
  if (v === void 0) return [];
  if (!Array.isArray(v) || v.length > 1e3 || !v.every((x) => typeof x === "string" && pattern.test(x)))
    throw new Error("invalid list");
  return v;
};
function parsePublisher(id, source) {
  const raw = readYaml(source);
  if (!record2(raw) || raw.schema !== 1) throw new Error("invalid publisher");
  only(raw, [
    "schema",
    "display_name",
    "contact_email",
    "support_email",
    "homepage",
    "github_owner_id",
    "maintainers"
  ]);
  const githubId = (v) => Number.isSafeInteger(v) && v > 0;
  if (!text(raw.display_name, 160) || !email.test(raw.contact_email ?? "") || !email.test(raw.support_email ?? "") || raw.homepage !== void 0 && !safeMetadataUrl(raw.homepage) || !githubId(raw.github_owner_id) || !Array.isArray(raw.maintainers) || !raw.maintainers.length || raw.maintainers.length > 10 || !raw.maintainers.every(githubId))
    throw new Error("invalid publisher");
  return {
    id,
    github_owner_id: raw.github_owner_id,
    display_name: raw.display_name,
    contact_email: raw.contact_email,
    support_email: raw.support_email,
    ...raw.homepage ? { homepage: raw.homepage } : {}
  };
}
var dsm7 = (v) => {
  try {
    return parseOsMinVer(v).major >= 7;
  } catch {
    return false;
  }
};
function parsePackage(publisher, file, source, reserved) {
  const raw = readYaml(source);
  if (!record2(raw) || raw.schema !== 1) throw new Error("invalid package");
  only(raw, [
    "schema",
    "package",
    "version",
    "displayname",
    "description",
    "os_min_ver",
    "category",
    "icon",
    "metadata",
    "source",
    "assets"
  ]);
  const id = raw.package;
  if (typeof id !== "string" || !/^[A-Za-z][A-Za-z0-9]{1,63}$/.test(id) || !new RegExp(`^C${publisher.github_owner_id}X[A-Za-z][A-Za-z0-9]*$`).test(id) || file !== `${id}.yaml`)
    throw new Error("package ID must be C<github_owner_id>X<Name> (2-64 ASCII alphanumerics; Name starts with a letter)");
  if (typeof raw.version !== "string" || !PACKAGE_VERSION.test(raw.version))
    throw new Error("version must look like 1.2.0-3");
  if (!text(raw.displayname, 80))
    throw new Error("displayname must be one line of at most 80 characters");
  if (raw.description !== void 0 && !text(raw.description, 1e3))
    throw new Error("description must be one line of at most 1,000 characters");
  if (raw.os_min_ver !== void 0 && (typeof raw.os_min_ver !== "string" || !dsm7(raw.os_min_ver)))
    throw new Error("os_min_ver must be a DSM 7 version such as 7.0-40000");
  if (raw.category !== void 0 && (typeof raw.category !== "string" || !CATEGORY.test(raw.category)))
    throw new Error("category must be a lowercase word");
  if (raw.icon !== void 0 && (typeof raw.icon !== "string" || !ICON_PATH.test(raw.icon) || /(?:^|\/)\.\.?(?:\/|$)|\/\//.test(raw.icon)))
    throw new Error("icon must be a .png path in the source repository");
  const lower = `${id} ${raw.displayname}`.toLowerCase();
  if (reserved.names.has(id.toLowerCase()) || reserved.words.some((w) => lower.includes(w)))
    throw new Error("reserved name");
  const src = raw.source;
  if (!record2(src)) throw new Error("invalid source");
  only(src, ["repo", "release"]);
  if (typeof src.repo !== "string" || !GITHUB_REPO.test(src.repo) || src.repo.split("/")[0].toLowerCase() !== publisher.id || typeof src.release !== "string" || !RELEASE_TAG.test(src.release) || src.release === "latest")
    throw new Error("invalid source");
  if (!Array.isArray(raw.assets) || raw.assets.length < 1 || raw.assets.length > 8)
    throw new Error("invalid assets");
  const arches = /* @__PURE__ */ new Set();
  const downloads = raw.assets.map((a) => {
    if (!record2(a)) throw new Error("invalid asset");
    only(a, ["name", "arch", "sha256", "size"]);
    if (typeof a.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.spk$/.test(a.name) || !validArch(a.arch) || !a.arch.every(isKnownArch) || typeof a.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.size) || a.size <= 0 || a.size > MAX_SPK2)
      throw new Error("invalid asset");
    addDisjointArch(arches, a.arch);
    return {
      arch: a.arch,
      link: `https://github.com/${src.repo}/releases/download/${src.release}/${a.name}`,
      size: a.size,
      sha256: a.sha256
    };
  });
  return {
    package: id,
    version: raw.version,
    dname: raw.displayname,
    desc: raw.description ?? "",
    ...raw.os_min_ver ? { osMinVer: raw.os_min_ver } : {},
    category: raw.category ?? "utilities",
    ...raw.icon ? {
      icon: `https://raw.githubusercontent.com/${src.repo}/${src.release}/${raw.icon}`
    } : {},
    metadata: raw.metadata === void 0 ? {} : validateMetadata(raw.metadata),
    publisher,
    downloads
  };
}
function parseModeration(source) {
  const raw = source === void 0 ? { schema: 1 } : readYaml(source);
  if (!record2(raw) || raw.schema !== 1) throw new Error("invalid moderation");
  only(raw, [
    "schema",
    "blocked_publishers",
    "blocked_packages",
    "blocked_sha256"
  ]);
  return {
    publishers: new Set(names(raw.blocked_publishers, slug)),
    packages: new Set(
      names(raw.blocked_packages, /^[A-Za-z][A-Za-z0-9_.-]{1,127}$/).map(
        (n) => n.toLowerCase()
      )
    ),
    sha256: new Set(names(raw.blocked_sha256, /^[a-f0-9]{64}$/))
  };
}
function parseReserved(source) {
  const raw = source === void 0 ? { schema: 1 } : readYaml(source);
  if (!record2(raw) || raw.schema !== 1)
    throw new Error("invalid reserved names");
  only(raw, ["schema", "names", "words"]);
  return {
    names: new Set(
      names(raw.names, /^[A-Za-z][A-Za-z0-9_.-]{1,127}$/).map(
        (n) => n.toLowerCase()
      )
    ),
    words: names(raw.words, /^[^\s]{2,40}$/).map((w) => w.toLowerCase())
  };
}
function checkedNames(source) {
  const taken = /* @__PURE__ */ new Set();
  if (source === void 0) return taken;
  for (const s of parseCatalogYaml(source))
    for (const p of s.pins) taken.add(p.package.toLowerCase());
  const raw = readYaml(source);
  for (const p of Object.values(raw.publishers ?? {}))
    for (const n of p.package_names ?? []) taken.add(n.toLowerCase());
  return taken;
}
function communityProblems(files) {
  const reason = (e) => e instanceof Error ? e.message : String(e);
  let reserved;
  try {
    parseModeration(files["moderation.yaml"]);
    reserved = parseReserved(files["reserved-names.yaml"]);
  } catch (e) {
    return [{ path: "moderation.yaml / reserved-names.yaml", message: reason(e) }];
  }
  const problems = [];
  const publishers = /* @__PURE__ */ new Map();
  const ownerIds = /* @__PURE__ */ new Set();
  let taken;
  try {
    taken = checkedNames(files["catalog.yaml"]);
  } catch (e) {
    return [{ path: "catalog.yaml", message: reason(e) }];
  }
  let count = 0;
  const counts = /* @__PURE__ */ new Map();
  for (const path of Object.keys(files).sort()) {
    const [, id, file] = /^community\/([^/]+)\/([^/]+)$/.exec(path) ?? [];
    if (!id || !file.endsWith(".yaml")) continue;
    if (!publishers.has(id)) {
      try {
        if (!slug.test(id) || id === "synopackageland")
          throw new Error("the publisher directory must be a lowercase ID");
        const source = files[`community/${id}/publisher.yaml`];
        if (source === void 0) throw new Error("publisher.yaml is missing");
        const publisher2 = parsePublisher(id, source);
        if (ownerIds.has(publisher2.github_owner_id)) throw new Error("GitHub owner ID already registered");
        ownerIds.add(publisher2.github_owner_id);
        publishers.set(id, publisher2);
      } catch (e) {
        publishers.set(id, void 0);
        problems.push({ path: `community/${id}/publisher.yaml`, message: reason(e) });
      }
    }
    const publisher = publishers.get(id);
    if (!publisher || file === "publisher.yaml") continue;
    try {
      const entry = parsePackage(publisher, file, files[path], reserved);
      const key = entry.package.toLowerCase();
      if (taken.has(key)) throw new Error("package ID is already used or reserved");
      taken.add(key);
      count++;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (count > TOTAL || counts.get(id) > PER_PUBLISHER) throw new Error("community package limit exceeded");
    } catch (e) {
      problems.push({ path, message: reason(e) });
    }
  }
  return problems;
}
async function checkCommunitySpk(body, asset, declared, expected) {
  try {
    const m = await inspectSpkStream(body, asset.size, { facts: true });
    if (m.sha256 !== asset.sha256)
      return [`${asset.name}: sha256 differs from the file at the release`];
    if (expected) {
      for (const field of ["package", "version", "os_min_ver"])
        if (expected[field] !== void 0 && m.info[field] !== expected[field])
          return [`${asset.name}: INFO.${field} differs from the catalog`];
      if (m.info.arch.split(/\s+/).sort().join(" ") !== [...expected.arch].sort().join(" "))
        return [`${asset.name}: INFO.arch differs from the catalog`];
    }
    return contradictions(m.facts, declared).map((p) => `${asset.name}: ${p}`);
  } catch (e) {
    return [`${asset.name}: ${e instanceof Error ? e.message : String(e)}`];
  }
}

// scripts/catalog/community-check.ts
async function checkCatalog(files, options = {}) {
  const problems = communityProblems(files).map((p) => `${p.path}: ${p.message}`);
  if (problems.length) return problems;
  const request = options.fetch ?? fetch;
  const json2 = async (path) => {
    const r = await request(`https://api.github.com${path}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(3e4)
    });
    if (!r.ok) {
      await r.body?.cancel();
      throw new Error(`GitHub metadata request failed (${r.status}); retry after rate limits reset`);
    }
    return await r.json();
  };
  for (const [path, source] of Object.entries(files)) {
    if (!/^community\/[^/]+\/[^/]+\.yaml$/.test(path)) continue;
    const raw = readYaml(source);
    try {
      const publisher = path.split("/")[1];
      const owner = readYaml(files[`community/${publisher}/publisher.yaml`]);
      if (path.endsWith("/publisher.yaml")) {
        if (options.owners && (await json2(`/users/${publisher}`)).id !== owner.github_owner_id)
          throw new Error("publisher directory does not match github_owner_id");
        continue;
      }
      if (options.owners) {
        const repo = await json2(`/repos/${raw.source.repo}`);
        if (repo.private !== false || repo.owner?.id !== owner.github_owner_id)
          throw new Error("source repository owner does not match github_owner_id or repository is private");
      }
      if (options.spk) for (const asset of raw.assets) {
        const url = `https://github.com/${raw.source.repo}/releases/download/${encodeURIComponent(raw.source.release)}/${encodeURIComponent(asset.name)}`;
        const r = await request(url, { signal: AbortSignal.timeout(12e4) });
        if (r.status !== 200 || !r.body) {
          await r.body?.cancel();
          throw new Error(`${asset.name} cannot be downloaded from the public release`);
        }
        const errors = await checkCommunitySpk(r.body, asset, raw.metadata ?? {}, {
          package: raw.package,
          version: raw.version,
          arch: asset.arch,
          os_min_ver: raw.os_min_ver
        });
        problems.push(...errors.map((p) => `${path}: ${p}`));
      }
    } catch (e) {
      problems.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return problems;
}

// scripts/catalog/check-community.mts
var args = process.argv.slice(2);
var i = args.indexOf("--catalog-dir");
var dir = i >= 0 ? args[i + 1] : ".";
if (args.includes("--help")) {
  console.log("node scripts/check-community.mjs [--catalog-dir <checkout>] [--owners] [--spk]");
  process.exit(0);
}
if (!dir || dir.startsWith("--") || args.some((arg, n) => !["--catalog-dir", "--owners", "--spk"].includes(arg) && !(i >= 0 && n === i + 1))) {
  console.error("Invalid arguments; use --help");
  process.exit(2);
}
try {
  const files = {};
  const read = (path, limit) => {
    const full = join(dir, path);
    const stat = lstatSync(full);
    if (!stat.isFile() || stat.size > limit) throw new Error(`${path}: expected a regular file within size limit`);
    files[path] = readFileSync(full, "utf8");
  };
  for (const name of ["catalog.yaml", "moderation.yaml", "reserved-names.yaml"]) read(name, name === "catalog.yaml" ? 1024 * 1024 : 65536);
  let count = 0;
  for (const publisher of readdirSync(join(dir, "community"), { withFileTypes: true })) {
    if (publisher.name === "README.md") continue;
    if (!publisher.isDirectory()) throw new Error("community entries must be publisher directories");
    for (const file of readdirSync(join(dir, "community", publisher.name), { withFileTypes: true })) {
      if (++count > 4096) throw new Error("too many community files");
      if (!file.isFile() || !file.name.endsWith(".yaml")) throw new Error("publisher entries must be regular YAML files");
      read(`community/${publisher.name}/${file.name}`, 65536);
    }
  }
  const problems = await checkCatalog(files, { spk: args.includes("--spk"), owners: args.includes("--owners") });
  for (const p of problems) console.error(`FAIL ${p}`);
  if (problems.length) process.exitCode = 1;
  else console.log(`PASS ${count} community files (schema, namespace, uniqueness${args.includes("--owners") ? ", GitHub ownership" : ""}${args.includes("--spk") ? ", SPK integrity and claims" : ""})`);
} catch (e) {
  console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}
