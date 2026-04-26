# Style base — Photorealistic Cinematic HDR

Stile visivo locked per **tutti i 18 video Nooland**. Override esplicito dello stile Pixar 3D di `scripts/fire-story.mjs`.

---

## STYLE_IMAGE (per nano-banana, generazione frame statico)

```
Ultra photorealistic cinematic HDR photograph, dramatic golden-hour Mediterranean light, hyper-detailed textures with realistic skin pores and fabric weave, sharp focus, 8K detail, deep saturated cinematic colors with slight teal-orange grade, natural directional lighting, documentary photography style, shot on Canon EOS R5 with 35mm lens at f/2.8, shallow depth of field with creamy bokeh, vertical 9:16 framing, no text, no watermark, no captions, no logos
```

## STYLE_MOTION (per seedance-pro, animazione 5s)

```
realistic subtle camera movement, natural human pacing, breathing life into the scene without exaggerated motion, gentle slow drift or push-in, documentary handheld feel, no whip pans, no quick cuts, soft cinematic motion blur
```

---

## LOCATION_SICILIA (incolla all'inizio di OGNI image prompt rurale)

```
Sicilian rural inland landscape near Caltanissetta or Enna in summer, rolling sun-bleached ochre hills, low dry stone walls, prickly pear cactus clusters in foreground, sparse old olive trees with twisted gnarled trunks, distant volcanic Mount Etna silhouette on horizon partially veiled in heat haze, dry yellow-ochre cracked soil, hot Mediterranean light, white limestone outcrops, agave plants
```

## LOCATION_MILANO (per scene urbane Marco)

```
modern Milan urban interior, contemporary office or apartment near Porta Nuova, large floor-to-ceiling windows showing Milan skyline with Bosco Verticale and Unicredit tower softly out of focus in distance, neutral grey-and-white minimalist decor, dark wood floors, daylight cool blue tone with slight haze, sterile contrast to warmer Sicilian scenes
```

## LOCATION_TRIBUNALE (per V10)

```
ornate Italian courtroom interior, dark walnut wood paneling, deep red velvet curtains, gleaming brass fixtures, tall arched windows with shafts of warm dust-lit light, raised judicial bench, red leather chairs, Italian flag and crucifix on back wall, austere dramatic mood
```

---

## NEGATIVE PROMPTS (usa nel prompt come "no X, no Y")

Sempre da includere alla fine di ogni image prompt:
```
no text, no watermark, no captions, no logos visible, no anachronistic objects, no plastic objects in old scenes, no cartoonish elements, no oversaturated red skies unless wildfire scene, no filters
```

---

## Risoluzione tecnica

- **Aspect ratio**: 9:16 (1080×1920 a render)
- **nano-banana**: `aspect_ratio: '9:16'`, `output_format: 'jpeg'`, `num_images: 1`
- **seedance-pro**: `aspect_ratio: '9:16'`, `resolution: '1080p'`, `duration: '5'`

---

## Composition rules per "first frame shock" (R3 mitigation)

Per il **clip 1 di ogni video**, il prompt image DEVE specificare il momento di climax visivo, NON un'apertura calma:

❌ Sbagliato (apertura calma):
> "Marco arriving at his desk in the morning, putting down his coffee"

✅ Corretto (frame 0 shock):
> "First frame: shocking close-up of Marco's worried face, eyes wide locked on phone screen showing 'TERRENO IN FIAMME' notification"

Le scene calme arrivano dal clip 2 in poi.
