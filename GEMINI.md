# Wedding Invitation Website (Invitación Digital de Boda) - Project Directives & Context

## 1. Project Overview
An elegant, modern, responsive digital wedding invitation website inspired by high-end classical wedding stationery. Built with pure HTML5, CSS3, and vanilla JavaScript for frictionless local previewing and zero-dependency deployment.

## 2. Palette & Design Language
- **Primary Burgundy:** `#6a1a24` / `#801323` (rich wine/burgundy)
- **Secondary Burgundy:** `#4a1018` (deep cabernet)
- **Sage Green Accent:** `#5e7153` / `#7a8d6e` (soft botanical sage)
- **Sage Green Light:** `#eef2ec` / `#f4f7f2` (delicate leaf background)
- **Ivory / Champagne Warm White:** `#fcfaf7` / `#f8f4ee`
- **Gold Accent:** `#c5a059` / `#d4af37` (subtle luxury borders and seals)
- **Typography:**
  - Headers: *Cormorant Garamond*, *Playfair Display*, serif
  - Script/Accents: *Great Vibes*, *Alex Brush*, cursive
  - Body & UI: *Montserrat*, *Inter*, sans-serif

## 3. Core Architecture
- `index.html`: Semantic single-page application structure.
- `css/styles.css`: CSS variables, custom 3D envelope animation, responsive layout, fluid typography, and dark-burgundy/sage transitions.
- `js/script.js`: Audio playback engine, countdown clock, interactive RSVP system with WhatsApp export, clipboard handlers, and smooth scroll navigation.
- `assets/`: SVGs, botanical ornaments, and audio assets.

## 4. Local Execution & Preview
Preview directly by opening `index.html` in any web browser, or launch a lightweight local server:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.
