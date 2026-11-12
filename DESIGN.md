# Design notes

## Who this is for

- **Who:** people on a team writing and reviewing shared working documents (notes, plans, proposals).
- **For what:** get words down, hand the document to a colleague, trust that nothing is lost.
- **Character:** a quiet, precise work tool. Not editorial, not playful, not premium.

## What it should feel like at its best

The document is the only thing with visual weight. Everything else recedes until it is needed.

1. **One focal point per screen.** In the editor it is the page. On the home screen it is the document list.
2. **One accent.** Blue marks the single primary action, the current selection, and keyboard focus. Nothing else is blue.
3. **Flat surfaces.** A surface is white with a hairline. Shadows are reserved for things that float (menus, popovers).
4. **Copy helps you act.** Labels say what will happen. The interface does not explain how the system works.
5. **Nothing decorative.** No gradients, emoji, or ornamental motion. A tool this plain has not earned them.

## Tokens

Defined in [app/globals.css](app/globals.css).

| Token | Value | Use |
|---|---|---|
| `canvas` | `#f7f7f8` | App background |
| `ink` | `#111827` | Primary text |
| `muted` | `#4b5563` | Secondary text (7:1 on white) |
| `line` | `#e5e7eb` | Hairlines, the only separator |
| `accent` | `#2563eb` | Primary action, selection, focus ring |
| `danger` | `#b91c1c` | Destructive actions and errors only |

| Rule | Value |
|---|---|
| Control height | 36 px (`.btn`, `.icon-btn`, `.field`), sized in rem so it scales with text zoom |
| Radius | 8 px for controls, 12 px for surfaces, full for avatars and pills |
| Type | Geist. 12 / 14 / 16 px for interface text, 20 and 24 px for titles. Document typography comes from the prose scale. |
| Focus | 2 px accent outline, 2 px offset, keyboard only, the same on every element |
| Motion | Colour transitions only. Disabled under `prefers-reduced-motion`. |

## Components

| Component | Rule |
|---|---|
| `.btn-primary` | At most one per screen |
| `.btn-secondary`, `.btn-quiet` | Everything else. Quiet for low-stakes actions inside toolbars and lists. |
| `Dialog` | The only modal. Traps focus, closes on Escape, returns focus to its opener. Bottom sheet on phones, drawer variant for history. |
| `Icon` | One stroke set. No emoji or unicode glyphs as icons. B, I, U and S stay as letters because that is the convention people recognise. |
| Overflow menu | Secondary and destructive document actions live here, never beside the primary action |

## What changed from the first version, and which screen triggered it

| Rule added | Triggered by |
|---|---|
| One primary action per screen | Editor header: History, Export, Delete and Share at equal weight, with a red Delete beside Share |
| Hairline or shadow, never both | Document list and the page sheet both had ring, shadow and background |
| One icon set, no emoji | Toolbar mixed a link emoji, unicode arrows and text labels |
| Controls are 36 px and sized in rem | Shortcuts button measured 25×18 px; icons did not grow at 200% text zoom |
| One modal primitive with focus management | Share dialog let Tab escape to the page and did not return focus; link and delete used native browser prompts |
| Copy helps you act | Home subtitle "Your documents and the ones shared with you"; history hint describing when revisions are recorded |
| No gradients | Login background gradient |

## How to check a change

`node scripts/design-audit.mjs <label>` walks login, home, editor, share, menu and history at 1440, 768 and 390 px, and at 200% text size. It saves screenshots to `screenshots/design-audit/<label>/` and reports horizontal overflow, targets under 24 px, unlabeled controls, and whether the dialog traps and returns focus.
