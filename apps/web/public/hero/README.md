# Hero background image

Drop your hero photo here as **`kabaddi-action.jpg`** (or `.webp` / `.avif`)
and update the `src` prop in
[`apps/web/src/app/(marketing)/page.tsx`](../../src/app/(marketing)/page.tsx)
where `<HeroSceneBg />` is rendered.

## Picking a photo

Look for: **wide-angle shot, mat in foreground, players mid-action, crowd visible behind**.
Landscape orientation. Faces / expressions read better than logos.

### Free / public-domain sources

- **Wikimedia Commons** — https://commons.wikimedia.org/ (search "Kabaddi" / "Pro Kabaddi League")
  → most photos here are CC-BY-SA, attribute the photographer
- **Pixabay** — https://pixabay.com/images/search/kabaddi/ (Pixabay licence, no attribution)
- **Pexels** — https://www.pexels.com/search/kabaddi/ (Pexels licence, no attribution)
- **Unsplash** — limited Kabaddi content, but try "athletics", "wrestling", "indian sports"

If none of those have the right shot, generate one with an AI tool
(Midjourney / DALL·E / Stable Diffusion) with a prompt like:
> "wide-angle action photograph of a Kabaddi match in progress, raider mid-leap with arm extended, defenders in chain formation, packed Indian stadium crowd in the background, dramatic stadium floodlights, cinematic, 16:9"

## Optimising before you commit it

Hero images should be under ~150KB. Use one of:

- **squoosh.app** (browser, free) — load image, choose AVIF or WebP, drop quality to ~70, resize width to 1920px
- **sharp** CLI: `npx sharp-cli -i hero.jpg -o hero.avif --avif quality=70 resize=1920`
- **ImageMagick**: `magick hero.jpg -resize 1920x -quality 70 hero.webp`

Target:
- 1920×1080 (or wider, 21:9 cinematic also fine)
- AVIF preferred, WebP if AVIF unsupported by your toolchain
- 80–150KB

## After you drop the file in

In `apps/web/src/app/(marketing)/page.tsx`, change:

```tsx
<HeroSceneBg /* src="/hero/kabaddi-action.jpg" */ />
```

to:

```tsx
<HeroSceneBg src="/hero/kabaddi-action.jpg" />
```

(Match the filename you saved.) The page will hot-reload and your photo
will appear behind the headline, with a theme-aware overlay keeping the text
crisp.
