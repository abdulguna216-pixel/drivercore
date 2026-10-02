# Generated visual assets

Built-in image_gen used for eight individual image requests. Final images: `public-site/assets/hero.webp`, `diagnostics.webp`, `brakes.webp`, `suspension.webp`, `maintenance.webp`, `tires.webp`, `workshop.webp`, `detail.webp`. Total ~756 KB. Original PNGs retained in Codex's generated-images folder; local source manifest is ignored at `.runtime/generated-assets.json`.

## Shared generation prompt, used verbatim before each scene

Use case: photorealistic-natural. Create a horizontal documentary photograph for the DRIVECORE automotive workshop website. Same workshop: charcoal steel lifts, off-white painted industrial walls, worn concrete floor, tool trolleys with small orange #FF5A1F details, technicians in charcoal work clothes. Candid working day, natural cool-neutral daylight about 4800K mixed with warmer work lamps. Full-frame 35mm lens, realistic materials and shadows, subtle film grain, moderately cinematic but completely believable, imperfect off-axis framing. No text anywhere, no signage, no random letters, no watermarks, no logos, no posing, nobody looks at camera, no sterile showroom, no CGI.

## Scene appended to each request

1. **Hero:** Wide landscape hero. Dark graphite modern European sedan raised slightly on a lift in a working service bay, car and activity concentrated in right two-thirds. Dark negative space across left third for HTML headline overlay. Technician partly visible behind the car working under hood. Tools and tire on floor. Slightly imperfect framing.
2. **Diagnostics:** Medium candid side view of technician in charcoal uniform connecting a diagnostic tablet to a dark sedan, photographed through foreground workshop equipment. Display abstract dark screen, no text. Focus on technician working, not posing.
3. **Brakes:** Close candid brake servicing shot: wheel removed, realistic used steel brake disc and caliper on sedan, orange tool trolley in soft background, mechanic gloved hands working with socket wrench. Hands anatomically plausible.
4. **Suspension:** Candid medium shot of a technician inspecting undercarriage suspension of dark sedan on orange-detailed charcoal lift. Side viewpoint, technician working below car, no pose.
5. **Maintenance:** Candid close-medium view of mechanic replacing oil filter under open hood of dark sedan. Real used tools on fender protective cloth, gloved hands, dark charcoal workwear and subtle orange cuff.
6. **Tires:** Candid tire service bay during balancing, technician beside worn tire changer with orange detail, wheel and tires stacked naturally. Work in progress, no posing.
7. **Workshop:** Wide alive documentary interior of the same workshop, three occupied bays, dark sedans partly occluded by equipment, used concrete floor, real tools, two working technicians seen from side/back. Off-axis composition and daylight.
8. **Detail:** Close-up of used ratchet wrench and workshop gloves resting on metal workbench next to a brake disc, orange tool trolley blurred behind, tactile realistic metal texture.

All inspected together for consistency, realism, absence of text/watermarks, believable equipment, candid people and restrained orange accents. Converted to WebP quality 83, hero max width 1920, other images max width 1000. These are image optimization steps; photographic contents were not composited or altered. Below-fold images use lazy loading; hero has fetchPriority=high. Image dimensions or CSS aspect ratios reserve space.
