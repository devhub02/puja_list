# Asset credits

All artwork in `mobile/assets/images/` is **original AI-generated artwork created by the project owner**.
No third-party images, stock photos or licensed artwork are used, so there is nothing to attribute.
Every file was converted from the owner's originals (resized and re-encoded, same artwork).

## Brand (`mobile/assets/images/brand/`)

| File | Use |
|---|---|
| `app-icon.png` | `expo.icon` in app.json; also the logo on the Home screen |
| `splash-icon.png` | Splash screen image (light and dark; both use the cream background because the logo text is dark maroon) |
| `adaptive-foreground.png` | Android adaptive icon foreground (logo scaled into the 66% safe zone; background colour `#FFF8EC` is set in app.json) |

`adaptive-foreground.png` is a derived file: the same logo artwork as `splash-icon`, centred on a 1024 px transparent canvas.

## Categories (`mobile/assets/images/categories/`)

| File | Category id |
|---|---|
| `category-household-pujas.webp` | `household` |
| `category-vrat-observances.webp` | `vrat` |
| `category-regional-festivals.webp` | `regional` |
| `category-major-festivals.webp` | `festival` |
| `category-special-occasions.webp` | `life_cycle` |
| `category-seasonal-festivals.webp` | not mapped (no matching content category); kept for later |

`tribal` has no image yet and uses the vector icon.

## Pujas (`mobile/assets/images/pujas/`)

`puja-<puja id without "puja_", underscores as hyphens>.webp`

| File | Puja id |
|---|---|
| `puja-bhai-dooj.webp` | `puja_bhai_dooj` |
| `puja-chhath.webp` | `puja_chhath` |
| `puja-diwali-lakshmi-puja.webp` | `puja_diwali_lakshmi_puja` |
| `puja-ganesh-chaturthi.webp` | `puja_ganesh_chaturthi` |
| `puja-govardhan.webp` | `puja_govardhan` |
| `puja-hanuman-puja.webp` | `puja_hanuman_puja` |
| `puja-hartalika-teej.webp` | `puja_hartalika_teej` |
| `puja-janmashtami.webp` | `puja_janmashtami` |
| `puja-jitiya.webp` | `puja_jitiya` |
| `puja-karwa-chauth.webp` | `puja_karwa_chauth` |
| `puja-maha-shivratri.webp` | `puja_maha_shivratri` |
| `puja-navratri-durga-puja.webp` | `puja_navratri_durga_puja` |
| `puja-raksha-bandhan.webp` | `puja_raksha_bandhan` |
| `puja-saraswati-puja.webp` | `puja_saraswati_puja` |
| `puja-satyanarayan-puja.webp` | `puja_satyanarayan_puja` |
| `puja-vishwakarma.webp` | `puja_vishwakarma` |

The id -> file mapping lives in one place: `mobile/src/theme/images.ts`.
