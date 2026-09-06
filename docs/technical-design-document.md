# Technical Design Document (TDD) - Digital Wedding Invitation

## 1. Technical Implementation Details

### 1.1 Envelope Opening Mechanics
- The envelope overlay sits at `z-index: 9999` with `position: fixed; inset: 0`.
- The envelope is constructed using CSS isometric triangles and flaps:
  - Envelope body: `linear-gradient` textured cream card paper.
  - Envelope top flap: `transform-origin: top center; transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)`.
  - Wax seal: A circular embossed button with a custom monogram ("S & M") positioned at the apex of the flap.
- When the guest clicks "ABRIR":
  1. The wax seal fades and detaches.
  2. The flap flips upwards: `transform: rotateX(180deg)`.
  3. The card inside translates upwards (`translateY(-70px)`).
  4. The whole overlay scales gently and fades out (`opacity: 0; pointer-events: none`).
  5. Audio is initialized and starts playing.

### 1.2 Audio Fallback Mechanism
Modern mobile browsers enforce strict autoplay policies. By triggering the audio directly inside the user's "ABRIR" click event handler, audio policy restrictions are satisfied. Furthermore, if an external MP3 file fails to load or the user is offline, an integrated Web Audio API gentle romantic chord arpeggio loop ensures delightful ambient sound plays seamlessly.

### 1.3 RSVP & WhatsApp Formatting
Guest responses are collected from the form:
- Attendance: "¡Sí, asistiré con mucha ilusión!" vs "Lamentablemente no podré asistir".
- Attendees count and names.
- Dietary preferences (e.g., Celíaco, Vegano, Vegetariano, Ninguna).
- Bus transport request.
- Personal message.
A JavaScript builder converts these entries into a WhatsApp message:
`https://wa.me/?text=Hola%20Sofía%20y%20Mateo!%20...`
opening the app directly with the pre-filled message.

### 1.4 1-Click Clipboard Copy
Uses `navigator.clipboard.writeText` with a fallback to `document.execCommand('copy')`. Displays an animated checkmark and "¡Copiado al portapapeles!" tooltip for 2.5 seconds.
