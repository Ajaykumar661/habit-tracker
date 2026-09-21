# Tally Wall

A medieval-fantasy, 16-bit habit tracker. Every day you keep is a mark cut into
the wall. React + Vite on the web, Capacitor for Android and iOS.

Everything stays on the device: no account, no server, no analytics. It works
with no connection at all.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run build        # production build into dist/
```

### Android, locally

```bash
npm run build
npx cap sync android

cd android
gradlew.bat assembleDebug
```

The debug build needs no signing setup and is unaffected by everything below.

## Creating an Android Release

Releases are cut from git tags. You never build or upload an APK by hand.

**1. Make your changes and push as usual.** Pushing to `main` does *not*
create a release.

```bash
git add .
git commit -m "Add streak shields"
git push
```

**2. When you're ready to release, tag it and push the tag.**

```bash
git tag v1.0.1
git push origin v1.0.1
```

That tag is what triggers
[`.github/workflows/android-release.yml`](.github/workflows/android-release.yml).
GitHub Actions then:

1. Checks out the repository
2. Installs dependencies (`npm ci`) and runs the tests
3. Builds the web app (`npm run build`)
4. Syncs Capacitor (`npx cap sync android`)
5. Builds the release APK (`./gradlew assembleRelease`)
6. Renames it to `TallyWall-v1.0.1.apk`
7. Creates the GitHub Release and attaches the APK

If the tests or the Android build fail, no release is created.

### Getting the APK

**GitHub → Releases → v1.0.1 → Assets → `TallyWall-v1.0.1.apk`**

Or link people straight to the latest release:

```
https://github.com/Ajaykumar661/habit-tracker/releases/latest
```

That URL always points at the newest stable release, so it never needs
updating. Send it once and it keeps working.

Android will warn about installing outside the Play Store; allowing
installation from the browser or file manager gets past it.

### Pre-releases

A tag with a hyphen in it is published as a GitHub *prerelease*, so it does
not show up as "Latest" and `releases/latest` keeps pointing at the last
stable build.

| Tag | Result |
| --- | --- |
| `v1.0.0` | Normal release |
| `v1.1.0` | Normal release |
| `v1.0.0-beta.1` | Prerelease |
| `v1.0.0-rc.1` | Prerelease |

### Versioning

| | Source | Example |
| --- | --- | --- |
| `versionName` | The git tag, without the `v` | `v1.2.3` → `1.2.3` |
| `versionCode` | The GitHub Actions run number | `42` |

`versionName` is what people see. `versionCode` is what Android compares when
deciding whether an APK is an upgrade, and it must only ever increase — the
run number does that for free. Deriving it from the version number instead
would break the first time two versions produced the same digits (`1.2.3` and
`1.2.30`), and an APK whose `versionCode` went backwards will not install over
the previous one.

Both are passed into Gradle as properties at build time:

```bash
./gradlew assembleRelease -PtallyVersionName=1.2.3 -PtallyVersionCode=42
```

so cutting a release never edits a tracked file. The defaults in
`android/app/build.gradle` (`1.0` / `1`) apply to local builds.

## Signing

Without signing secrets the workflow still runs, but produces an **unsigned**
APK that Android will refuse to install. The release notes say so when that
happens. To get properly signed builds, create a keystore **once**, keep it
somewhere safe, and add four repository secrets.

> The keystore and its passwords must never be committed. `*.jks` and
> `*.keystore` are already ignored under `android/`, and the workflow writes
> the decoded keystore to a temporary directory outside the checkout.

**1. Create a keystore** (keep the generated file and the passwords safe — if
you lose them you cannot ship an update to anyone who installed the old APK):

```bash
keytool -genkeypair -v \
  -keystore tallywall-release.jks \
  -alias tallywall \
  -keyalg RSA -keysize 2048 -validity 10000
```

**2. Base64-encode it**, so it can live in a secret:

```bash
# macOS / Linux
base64 -i tallywall-release.jks | tr -d '\n' > keystore.base64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("tallywall-release.jks")) > keystore.base64.txt
```

**3. Add the secrets** under
*Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The whole contents of `keystore.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password from step 1 |
| `ANDROID_KEY_ALIAS` | `tallywall` (the `-alias` from step 1) |
| `ANDROID_KEY_PASSWORD` | The key password (often the same as the keystore password) |

**4. Delete `keystore.base64.txt`** and keep the `.jks` file offline.

The next tag you push will produce a signed, installable APK. Secrets are
masked in logs and never written into the repository.
