# Architecture Design Document (ADD) - Digital Wedding Invitation

## 1. System Architecture
A client-only web application structured into three layers:
- **Presentation Layer (`index.html`)**: Semantic markup representing the envelope modal overlay, hero section, narrative modules, event schedule cards, timeline, RSVP form, and footer.
- **Styling & Animation Layer (`css/styles.css`)**:
  - CSS Custom Properties (`--burgundy-primary`, `--sage-primary`, `--sage-light`, `--gold`, etc.).
  - 3D CSS perspective transforms (`transform-style: preserve-3d`, `rotateX`) for the realistic envelope flap opening.
  - Mobile-first media queries and CSS grid/flexbox layouts.
- **Interactivity & State Layer (`js/script.js`)**:
  - Audio management with Web Audio API fallback synthesizer + HTML5 audio element.
  - Dynamic countdown timer ticker using `setInterval`.
  - Clipboard API interaction for IBAN copying.
  - WhatsApp URI formatting (`encodeURIComponent`).
  - Google Calendar / .ics event file dynamic generation.

## 2. Component Diagram
```
+-------------------------------------------------------------+
|                      Browser Viewport                       |
|                                                             |
|  [ Full-Screen Envelope Modal (3D Flap + Wax Seal + ABRIR) ]|
|                               | (User Click)                |
|                               v                             |
|  [ Unfold Animation & Background Romantic Audio Activation ] |
|                               |                             |
|                               v                             |
|  [ Main Wedding Invitation Single Page Application ]         |
|   - Hero Section & Couple Monogram                          |
|   - Love Quote & Parents' Blessing                          |
|   - Live Countdown Clock                                    |
|   - Venues & Schedules (Ceremony, Reception, Party)         |
|   - Timeline of the Day                                     |
|   - Interactive RSVP (WhatsApp message generator)           |
|   - Dress Code & Swatches + Adults-Only Notice              |
|   - Gift Registry (1-Click IBAN Copy)                       |
|   - Hotel Accommodations & Collaborative Playlist           |
|                                                             |
|  [ Floating Audio Toggle Button + Quick RSVP Navigation ]   |
+-------------------------------------------------------------+
```
