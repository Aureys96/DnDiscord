# DnD Voice Chat - Theme & Colors

## Color Philosophy

We use a dark theme as the primary (and initially only) theme. Dark themes:
- Reduce eye strain during long DnD sessions (4+ hours)
- Create immersive atmosphere
- Are expected by Discord users
- Work well with accent colors for indicators

## Color Palette

### Base Colors (Dark Theme)

```
Background Hierarchy (darkest to lightest):
──────────────────────────────────────────
bg-primary     #111827  (gray-900)   Main background
bg-secondary   #1F2937  (gray-800)   Sidebars, cards
bg-tertiary    #374151  (gray-700)   Hover states, elevated elements
bg-quaternary  #4B5563  (gray-600)   Active states, borders

Text Hierarchy:
──────────────────────────────────────────
text-primary   #F9FAFB  (gray-50)    Main text, headings
text-secondary #D1D5DB  (gray-300)   Secondary text, labels
text-muted     #9CA3AF  (gray-400)   Muted text, timestamps
text-disabled  #6B7280  (gray-500)   Disabled text
```

### Accent Colors

```
Brand/Primary:
──────────────────────────────────────────
accent-primary    #8B5CF6  (violet-500)   Primary actions, links
accent-hover      #7C3AED  (violet-600)   Hover state
accent-active     #6D28D9  (violet-700)   Active/pressed state

We use violet instead of Discord's blurple to differentiate
and give a more mystical/fantasy feel appropriate for DnD.
```

### Semantic Colors

```
Status Indicators:
──────────────────────────────────────────
success        #10B981  (emerald-500)  Online, connected, success
success-bg     #065F46  (emerald-800)  Success backgrounds
warning        #F59E0B  (amber-500)    Idle, warnings
warning-bg     #92400E  (amber-800)    Warning backgrounds
error          #EF4444  (red-500)      Offline, errors, muted
error-bg       #991B1B  (red-800)      Error backgrounds
info           #3B82F6  (blue-500)     Info, links
info-bg        #1E40AF  (blue-800)     Info backgrounds

Voice Indicators:
──────────────────────────────────────────
speaking       #22C55E  (green-500)    User is speaking
speaking-glow  #22C55E40              Speaking glow (with alpha)
muted          #EF4444  (red-500)      Microphone muted
deafened       #EF4444  (red-500)      Audio deafened
connecting     #F59E0B  (amber-500)    Connecting to voice
```

### Role Colors

```
User Roles:
──────────────────────────────────────────
role-dm        #F59E0B  (amber-500)    Dungeon Master (gold/crown)
role-player    #8B5CF6  (violet-500)   Regular player
role-spectator #6B7280  (gray-500)     Spectator (future)

These colors appear:
- Next to usernames
- On role badges
- In member list groupings
```

### Interactive Element Colors

```
Buttons:
──────────────────────────────────────────
btn-primary-bg      #8B5CF6  (violet-500)
btn-primary-hover   #7C3AED  (violet-600)
btn-primary-text    #FFFFFF

btn-secondary-bg    #374151  (gray-700)
btn-secondary-hover #4B5563  (gray-600)
btn-secondary-text  #F9FAFB  (gray-50)

btn-danger-bg       #DC2626  (red-600)
btn-danger-hover    #B91C1C  (red-700)
btn-danger-text     #FFFFFF

btn-ghost-bg        transparent
btn-ghost-hover     #374151  (gray-700)
btn-ghost-text      #D1D5DB  (gray-300)

Inputs:
──────────────────────────────────────────
input-bg            #1F2937  (gray-800)
input-border        #374151  (gray-700)
input-focus-border  #8B5CF6  (violet-500)
input-text          #F9FAFB  (gray-50)
input-placeholder   #6B7280  (gray-500)
```

## Tailwind CSS Configuration

```javascript
// tailwind.config.js theme extension
module.exports = {
  theme: {
    extend: {
      colors: {
        // We primarily use Tailwind's default colors
        // Custom semantic tokens can be added via CSS variables
      },
    },
  },
};
```

## CSS Custom Properties

```css
/* Root theme variables */
:root {
  /* Backgrounds */
  --bg-primary: theme('colors.gray.900');
  --bg-secondary: theme('colors.gray.800');
  --bg-tertiary: theme('colors.gray.700');
  --bg-quaternary: theme('colors.gray.600');

  /* Text */
  --text-primary: theme('colors.gray.50');
  --text-secondary: theme('colors.gray.300');
  --text-muted: theme('colors.gray.400');

  /* Accent */
  --accent: theme('colors.violet.500');
  --accent-hover: theme('colors.violet.600');

  /* Status */
  --status-online: theme('colors.emerald.500');
  --status-idle: theme('colors.amber.500');
  --status-offline: theme('colors.gray.500');
  --status-dnd: theme('colors.red.500');

  /* Voice */
  --voice-speaking: theme('colors.green.500');
  --voice-muted: theme('colors.red.500');

  /* Roles */
  --role-dm: theme('colors.amber.500');
  --role-player: theme('colors.violet.500');

  /* Spacing (consistent with Tailwind) */
  --sidebar-width: 240px;
  --room-list-width: 64px;
  --user-controls-height: 52px;
  --header-height: 48px;
}
```

## Typography

```
Font Stack:
──────────────────────────────────────────
Primary:    'Inter', system-ui, sans-serif
Monospace:  'JetBrains Mono', 'Fira Code', monospace

Font Sizes (Tailwind scale):
──────────────────────────────────────────
xs:    0.75rem   (12px)  Timestamps, badges
sm:    0.875rem  (14px)  Secondary text, labels
base:  1rem      (16px)  Body text, messages
lg:    1.125rem  (18px)  Subheadings
xl:    1.25rem   (20px)  Section headings
2xl:   1.5rem    (24px)  Page titles
3xl:   1.875rem  (30px)  Large headings (rare)

Font Weights:
──────────────────────────────────────────
normal:    400   Body text
medium:    500   Emphasis, usernames
semibold:  600   Headings, buttons
bold:      700   Strong emphasis (rare)

Line Heights:
──────────────────────────────────────────
tight:     1.25  Headings
normal:    1.5   Body text
relaxed:   1.625 Long-form text (rare)
```

## Shadows & Effects

```
Box Shadows:
──────────────────────────────────────────
shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.3)
shadow:      0 2px 4px rgba(0, 0, 0, 0.3)
shadow-md:   0 4px 6px rgba(0, 0, 0, 0.3)
shadow-lg:   0 8px 16px rgba(0, 0, 0, 0.4)
shadow-xl:   0 16px 32px rgba(0, 0, 0, 0.5)

(Shadows are more pronounced in dark theme)

Glow Effects (for speaking indicator):
──────────────────────────────────────────
speaking-glow: 0 0 0 3px rgba(34, 197, 94, 0.4)

Transitions:
──────────────────────────────────────────
Default duration: 150ms
Easing: ease-in-out
Properties: colors, opacity, transform, box-shadow
```

## Border Radius

```
Consistent Radius Scale:
──────────────────────────────────────────
rounded-sm:   2px    Subtle rounding
rounded:      4px    Default (inputs, small buttons)
rounded-md:   6px    Cards, panels
rounded-lg:   8px    Modals, larger elements
rounded-xl:   12px   Feature cards
rounded-full: 9999px Avatars, badges, icons
```

## Avatar Sizes

```
Size Scale:
──────────────────────────────────────────
xs:   24px   Inline mentions, small lists
sm:   32px   Member list, compact views
md:   40px   Message avatars, standard
lg:   48px   User controls, profiles
xl:   64px   Room icons, large profiles
2xl:  80px   Profile modals
3xl:  128px  Full profile view
```

## Dark Theme Only (For Now)

We start with dark theme only because:
1. DnD sessions often happen in evening
2. Discord users expect dark theme
3. Simpler to implement one theme well
4. Can add light theme later if requested

If light theme is added later, we'll use CSS custom properties
to swap color values without changing component code.
