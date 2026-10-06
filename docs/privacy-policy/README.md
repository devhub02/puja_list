# Publishing the privacy policy (GitHub Pages)

The policy is `index.md` in this folder. It needs a public address that the Play Console and the app can open.

## 1. Fill in the placeholders

In `index.md`, replace every `{{CONTACT_EMAIL}}` and `{{EFFECTIVE_DATE}}` with your real values. Then resolve every
`[VERIFY ...]` marker (or remove it after checking) with you or a lawyer. Do not publish with markers left in.

## 2. Create a Pages site

Option A, a separate public repository (recommended, so the app repo stays private if you want):
1. On GitHub, create a new public repository, for example `puja-saathi-privacy`.
2. Copy `index.md` into it as `index.md`, plus a `_config.yml` containing `theme: jekyll-theme-minimal`.
3. In the repository: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, branch `main`, folder `/ (root)`.

Option B, inside this repository:
1. Settings > Pages > Source: `main`, folder `/docs`.
2. The file is then at `/docs/privacy-policy/` (GitHub serves `index.md` as a page).

## 3. Check the live URL

1. Wait about a minute after the first deploy. The address is shown in Settings > Pages, for example
   `https://YOUR-USER.github.io/puja-saathi-privacy/`.
2. Open it in a browser (not inside the app). Check that the English and Hindi sections show, and that no placeholder
   is left.
3. Note the exact address: you will paste it in two places.

## 4. Where to paste the address

- **Play Console:** App content > Privacy policy > paste the URL.
- **The app:** `PRIVACY_POLICY_URL` in `mobile/src/config/legal.ts`. It is empty until you set it; while it is empty the
  Settings row is hidden. Set it, rebuild, and check the row opens the page.

## 5. Keep it current

When the app changes what it stores or sends, update `index.md`, the effective date, and publish again.
