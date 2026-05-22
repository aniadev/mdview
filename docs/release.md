# Release Process

This document outlines the release process for **mdview**.

## Step-by-Step Release Guide

### 1. Preparation & Local Setup

1. Check current build, lint, and typechecks before releasing to ensure stability:
   ```bash
   pnpm typecheck
   cargo check --manifest-path src-tauri/Cargo.toml
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   ```

2. Update the version number in the following configuration files:
   - `package.json`: `"version": "x.y.z"`
   - `src-tauri/Cargo.toml`: `version = "x.y.z"`
   - `src-tauri/tauri.conf.json`: `"version": "x.y.z"`

3. Document the new version's additions, changes, and fixes in `CHANGELOG.md` under a new section matching the standard style:
   ```markdown
   ## [x.y.z] — YYYY-MM-DD
   
   ### Added
   - Feature details...
   
   ### Fixed
   - Bug fix details...
   ```

### 2. Commit and Tag

Once version configuration and the changelog have been updated, commit the changes to `main` and tag the release:
```bash
git add .
git commit -m "chore: release vx.y.z"
git tag vx.y.z
```

### 3. Push and Trigger CI/CD Pipeline

Push the code and tag to GitHub to trigger the release pipeline (`.github/workflows/release.yml`):
```bash
git push origin main
git push origin vx.y.z
```

---

## CI/CD Release Pipeline Details

The GitHub Actions workflow manages the builder pipeline entirely:

1. **`create-release`**:
   - Spawns on tags matching `v*`.
   - Generates a new GitHub Release draft/publication using `softprops/action-gh-release@v2`.

2. **`build`** (Matrix Platforms):
   - **macOS (macos-latest)**: Target `universal-apple-darwin` generates `.app`/`.dmg` targets.
   - **Windows (windows-latest)**: Target `x86_64-pc-windows-msvc` generates NSIS installers (`.exe`/`.msi`).
   - **Linux (ubuntu-22.04)**: Target `x86_64-unknown-linux-gnu` produces AppImage and `.deb` bundles.
   - Runs `pnpm tauri signer sign` dynamically in the runner for the built packages using `TAURI_SIGNING_PRIVATE_KEY` to sign application bundles for secure updates.

3. **`update-manifest`**:
   - Collects release assets and generated `.sig` signatures.
   - Builds/updates `download/latest.json`.
   - Auto-commits and pushes the updated JSON file back to the `main` branch to update the in-app updater.
