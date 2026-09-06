# Software Requirements Specification (SRS) - Digital Wedding Invitation

## 1. Introduction
### 1.1 Purpose
This document specifies the software requirements for the digital wedding invitation website. The web application allows wedding guests to experience an opening envelope animation, review all details of the celebration, listen to background ambient music, confirm their attendance via an interactive form, and access essential event logistics.

### 1.2 Scope
The application is a standalone, client-side single-page application (SPA) created in modern HTML5, CSS3, and JavaScript (ES6+), optimized for mobile devices and desktop screens without requiring server-side rendering or backend dependencies.

## 2. Functional Requirements
- **FR-01: Envelope Opening Animation**: When loaded, display an envelope with a seal and "ABRIR" button. Upon clicking, perform a 3D flap opening and card unfolding animation, reveal the full website, and trigger background music.
- **FR-02: Music Player**: Provide continuous background romantic music with a floating play/pause control button accessible at any scroll position.
- **FR-03: Real-Time Countdown**: Display a dynamic counter showing days, hours, minutes, and seconds until the wedding date.
- **FR-04: Event Schedule & Navigation**: Provide cards for Ceremony, Cocktail/Reception, and Party, complete with location details, "Ver Mapa" Google Maps links, and calendar integration.
- **FR-05: Visual Timeline**: Display an illustrated vertical timeline of key events throughout the wedding day.
- **FR-06: Interactive RSVP & WhatsApp Integration**: Allow guests to submit attendance status, guest count, shuttle bus requirement, and dietary restrictions. Format and export the confirmation message directly to WhatsApp.
- **FR-07: Dress Code & Color Palette**: Present dress code guidance along with visual color swatches and kids policy.
- **FR-08: Gift Registry & 1-Click Copy**: Display bank account / IBAN information with an instant clipboard copy button and visual toast confirmation.
- **FR-09: Playlist & Accommodation**: Allow guests to suggest dance floor songs and browse suggested hotels.

## 3. Non-Functional Requirements
- **NFR-01: Performance**: Instant load time (<1 second) with zero bulky JavaScript frameworks.
- **NFR-02: Responsive Design**: Fully optimized for mobile viewports (360px - 430px) as well as tablet and desktop viewports.
- **NFR-03: Cross-Browser Compatibility**: Support modern Chromium, WebKit (Safari iOS/macOS), and Firefox browsers.
- **NFR-04: Offline & Local Execution**: Can be run directly via `file:///` protocol or basic local HTTP server.
