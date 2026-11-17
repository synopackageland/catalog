# App screenshots

Screenshots for the App page on synopkgland.com. Reference them from
`metadata.screenshots` (desktop) or `metadata.screenshots_mobile` (phone) in
`catalog.yaml` (at most 10 in each list, `https://` only).

## Layout

```
screenshots/<PackageName>/01-main.png
screenshots/<PackageName>/02-settings.jpg
```

- `<PackageName>` is the exact `package` ID from `catalog.yaml` (for example `SynoPkgConnect`).
- Files are `NN-short-name.<ext>`: two-digit order, lowercase letters, digits and `-`.
  Only `.png` and `.jpg` are accepted. raw.githubusercontent.com serves WebP as
  `application/octet-stream`, so clicking it would download instead of opening.
- Each file is at most **500 KB**. Compress PNGs (for example `oxipng`, `pngquant`) or save a JPEG.
- Desktop: use **1280×800** (16:10), or the real size of the DSM window at 16:10. Any other
  ratio is shown whole inside a 16:10 frame, with empty margins.
- Phone: use **390×844** (a portrait phone viewport) and name it `NN-phone-short-name`.
  It is shown in a 390:844 frame under the App page's Mobile tab.
- Show the app, not the whole desktop; crop out other packages, hostnames, IP addresses,
  user names and anything private.
- Never replace a file under the same name for a different image: browsers and
  GitHub cache it for 5 minutes. A new version of a screenshot gets a new file name.

## Link

```yaml
metadata:
  screenshots:
    - https://raw.githubusercontent.com/synopackageland/catalog/main/screenshots/SynoPkgConnect/01-main.png
  screenshots_mobile:
    - https://raw.githubusercontent.com/synopackageland/catalog/main/screenshots/SynoPkgConnect/01-phone-main.png
```

Packages hosted elsewhere do not need this directory: any `https://` image URL works.
