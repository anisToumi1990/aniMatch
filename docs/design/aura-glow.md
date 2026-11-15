# Aura glow — design spec

## Goal

The app must feel adult, calm and premium ("what's your aura?"), not childish.

## Remove

- The mint-green backgrounds
- The paw-print background pattern
- Emojis in titles (e.g. "👇 Meet the Auras 👇")
- Bright playful colors

## Theme

Dark only for now. Hide the light/dark toggle in the account popup.

| Token | Value |
|---|---|
| Background | `#0E0F13` |
| Cards | `#17181F` |
| Raised cards | `#1F2029` |
| Borders (thin, 1px) | `#2A2C36` |
| Text | `#F2F2F5` |
| Secondary text | `#A6A8B3` |
| Muted | `#6B6E7A` |

- **Primary button:** light pill (`#F2F2F5` background, `#0E0F13` text, fully rounded).
- **Secondary button:** outline `#2A2C36`.
- **Titles:** medium weight (500), sentence case, generous spacing.
- **Wordmark:** small "ANIMATCH" with wide letter spacing at the top.
- All colors live in `constants/Colors.ts` as named tokens; no hardcoded colors in screens.

## Aura colors

Each animal has its own color, used everywhere that animal appears.

| Animal | Color |
|---|---|
| Fox | `#D85A30` |
| Lion | `#EF9F27` |
| Wolf | `#378ADD` |
| Owl | `#7F77DD` |
| Cat | `#D4537E` |
| Deer | `#1D9E75` |
| Dolphin | `#3BA3D9` |
| Eagle | `#C9A55A` |
| Elephant | `#8A8D99` |
| Otter | `#B07A4B` |
| Parrot | `#63A322` |
| Peacock | `#1E8C9E` |
| Snake | `#3FB37F` |
| Unicorn | `#B58CE6` |
| Bear | `#A0522D` |

## AuraAvatar component

Reusable. The animal image inside a dark circle with a thin border in its aura color, surrounded by 2 soft concentric rings of the same color at low opacity (the "aura").

Sizes:

- **small** — lists
- **medium** — carousel
- **large** — results / popup

## Apply to

- **Home screen:** hero title "What's your aura?", subtitle, aura carousel with AuraAvatar, primary button
- Quiz screens
- **Results screen:** large AuraAvatar + aura-colored accents
- **Compatibility screen:** both auras side by side
- Notifications
- Login / register
- The account popup and the aura popup
- **Tab bar:** dark, active tab in `#F2F2F5`

## Constraints

- Don't change any logic, data or Supabase calls — visual only.
- Must work on iOS and web.
