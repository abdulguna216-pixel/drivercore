# DRIVECORE · Design system

Source: UI UX Pro Max SKILL.md and references/quick-reference.md read directly in GitHub, without installing or downloading the skill. The local --design-system search engine was not run at the user's request. Decisions below are a manual application of verified static guidance and the project specification, not fabricated search results.

## Product
B2C automotive booking landing page + B2B service management CRM. React/TypeScript/Vite. Public: trust, technical precision, one booking CTA, documentary imagery, hero → proof → services → process → workshop → booking → contacts. CRM: persistent sidebar, deep links, dense tables, visible actions, forms grouped by purpose, keyboard alternative for Kanban dragging.

## Tokens
Accent #FF5A1F; on-accent #17100C (dark text ensures contrast). Marketing background #0E0F11, surface #17191D, elevated #202329, text #FFFFFF, secondary #ADB2BC, border #3A3F49. CRM background #F5F6F8, surface #FFFFFF, text #1B2029, secondary #626B78, border #DCE0E6. Success #17734A, warning #825500, error #B42335, info #245BB2 with pale status surfaces and visible labels. Typeface: system sans, bold condensed-feeling display with restrained tracking, body 16/1.6, CRM 14/1.5. Scale 12,14,16,18,24,32,48,64,80. Weights 400,500,600,700,800. Tabular figures for money, counts and dates.
Spacing 4,8,12,16,24,32,48,64,96. Radius 4,6,8,12; CRM cards 8. Shadow small 0 2px 8px rgba(17,24,39,.04), overlay 0 24px 80px rgba(0,0,0,.2). Marketing container 1280px. Breakpoints 375/768/1024/1440. Buttons/inputs >=44px, compact desktop table cells 14px/16px, row ~56px, sidebar 236px. State transition 140ms, overlay 200ms; transform/opacity only. Respect reduced motion.

## UX
Native labels and required fields; loading/disabled on submits; retained form data on errors; role=alert; consistent visible focus; semantic buttons; 44px targets; overflow-wrap for IDs/VIN. Dialog focus trap + Escape + focus return. Status select is an alternative to DnD. Global search debounced; pagination on listings; empty/loading/error/success states. Charts have labels and accessible data tables. Sidebar drawer on mobile; tables scroll inside their container, never the entire page. No emoji icons, neon, glass overload, invented activity or sample financial numbers. Empty seed CRM is intentional.

## Visual direction
Documentary automotive photography in the same used workshop: charcoal steel, off-white walls, worn concrete, orange #FF5A1F lift/tool trolley details, technicians in charcoal workwear. 35mm full-frame lens feel, available cool-neutral daylight (4800K) with warmer practical lamps, realistic shadows, moderate contrast, subtle film grain. Imperfect candid framing, no looking at camera, no staging. Hero wide shot with negative left third. Other images purposeful close/medium/wide frames. No text, watermarks, signs, logos, CGI, posed smiles or polished showroom.
