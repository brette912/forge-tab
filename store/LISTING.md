# Chrome Web Store listing: Forge Tab

Copy each section into the matching field in the Chrome Web Store developer dashboard.

## Store listing tab

**Name:** Forge Tab

**Summary (132 characters max):**
A fast new tab with unlimited shortcuts in groups, type-to-launch, notes, saved commands and site status checks.

**Category:** Productivity → Workflow & Planning

**Language:** English

**Description:**

Forge Tab turns your new tab into a calm, fast home screen with room for every site you use.

UNLIMITED SHORTCUTS
• Make as many groups as you want, each with its own name and colour
• Drag shortcuts to reorder them or move them between groups
• Use the site's icon, a letter, an emoji, your own image, or fetch a sharp logo from any website

TYPE TO LAUNCH
• Start typing anywhere on the page
• Matching shortcuts and commands appear first; press Enter to open
• Anything else searches with your default search engine

NOTES
• Quick notes that save as you type
• Pin the important ones, colour-code them, and search them

SAVED COMMANDS
• Keep the terminal commands you always forget, for Windows, Linux or Mac
• Click to copy. Put a word in braces, like {port}, and Forge Tab asks for it when you copy

STATUS CHECKS
• Small chips next to the clock show whether your websites or home server are up
• Point one at an Ollama server to see how many models it has and which are running

PRIVATE BY DESIGN
• No account, no analytics, no ads, no tracking
• Everything stays in Chrome on your computer
• Export your layout to a file and import it anywhere

Open source under the MIT license.

**Graphics:**
- Icon: `extension/icons/icon128.png`
- Screenshots (1280×800): `screenshot-1-home.png`, `screenshot-2-launch.png`, `screenshot-3-commands.png`, `screenshot-4-edit.png`
- Small promo tile (440×280): `promo-small-440x280.png`

**Homepage URL:** https://github.com/brette912/forge-tab
**Support URL:** https://github.com/brette912/forge-tab/issues

## Privacy practices tab

**Single purpose:**
Forge Tab replaces Chrome's new tab page with a customizable home screen of grouped shortcuts, with type-to-launch, notes, saved commands and optional status checks.

**Permission justifications:**
- **storage:** Saves the user's shortcuts, groups, notes, commands and settings locally.
- **unlimitedStorage:** Custom shortcut icons are stored as images, which can exceed the default storage limit.
- **favicon:** Shows each shortcut's site icon from Chrome's own favicon cache.
- **search:** Sends text typed in the search box to the user's default search engine, as required for new tab pages.
- **Host permissions (optional, http/https):** Requested only when the user clicks Get logo (to download that site's logo) or saves an Ollama status check (to read that server's model list). Not used otherwise.

**Remote code:** No, I am not using remote code.

**Data usage:** Check none of the data types. Then tick all three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** https://github.com/brette912/forge-tab/blob/main/PRIVACY.md
