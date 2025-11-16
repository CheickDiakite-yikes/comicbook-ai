# Animation Studio UI/UX Spec v1.0

## 1. Product POV & Mental Model
- **Hierarchy**: Project → Scenes (exportable clips) → Beats (optional grouping) → Clips organized in tracks (Panel, Camera, Prompt, FX, Audio).
- **Workflow**: Drag finished comic panels into beats, layer motion + prompts, preview, adjust timing, render per scene.
- **Goal**: Deliver a lightweight, cinematic editor that feels like Premiere/CapCut while honoring Kumayiri's handcrafted comic DNA.

### Core User Jobs
1. Assemble a scene by dragging panels into time-ordered beats on the timeline.
2. Add motion (camera moves, transitions, parallax) plus prompts that preserve character/prop/style consistency.
3. Preview quickly (low-latency stub followed by Veo render).
4. Adjust timing (trim, reorder, ripple) and add transitions.
5. Render, version, and compare outputs.

### Pain Points in Current Build
- No true timeline (card stack instead of scrubbable time ruler).
- Controls scattered; inheritance unclear.
- Prompt area unstructured, no connection to timeline clips.
- Render queue detached from work area.
- Mobile view lacks hierarchy, gestures, and time sense.

## 2. Information Architecture
- **Project Defaults** → cascades down.
- **Pages** (panels live here).
- **Scenes** (each exports as a clip, inherits project defaults by default).
- **Beats** (logical grouping of clips inside a scene).
- **Tracks & Clips**:
  - Panel Track: still panels converted to video clips.
  - Camera Track: shot templates (dolly, parallax, whip, tilt, handheld).
  - Prompt Track: tokenized prompt chips with inheritance + overrides.
  - FX Track: overlays (glow, halftone, grain, speed ramps).
  - Audio Track: mood beds, uploads, ducking markers.
- **Inheritance Model**: Project defaults → Scene defaults → Clip overrides. Inspector shows provenance + "Reset to inherited".

## 3. Desktop Layout
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: [ Project ▾ ] [ Page Editor | Animation | Script ] [Preview 1x]  │
│         [ Undo/Redo ] [ Save ] [ Render ] [ Help ]                         │
├───────────────┬─────────────────────────────────────────────┬──────────────┤
│ Left Sidebar  │ Canvas + Player                             │ Right Panel  │
│ (Assets)      │ • Large preview w/ safe areas & guides      │ (Inspector)  │
│ • Pages ▾     │ • Transport under canvas                    │ • Context tabs│
│ • Panels ▾    │ • On-canvas gizmos for focus/camera paths   │   Scene/Beat/ │
│ • Scenes ▾    │                                             │   Clip        │
│ • Search 🔎   │                                             │              │
├───────────────┴─────────────────────────────────────────────┴──────────────┤
│ Timeline Dock                                                              │
│ Time ruler + markers; tracks (Panel, Camera, Prompt, FX, Audio).           │
└────────────────────────────────────────────────────────────────────────────┘
```

### Asset Browser (Left)
- Tabs: Pages, Panels, Scenes, Search.
- Filters: character, location, prop, style, tag, recency, page number.
- Actions: drag to timeline, multi-select, right-click → "Create Beat from selection".
- Empty state: "No panels yet. Generate from script → Page Editor."

### Player Canvas (Center)
- Transport controls: Play/Pause (Space), Step (←/→), Shuttle (J/K/L), Loop, Fit/Fill (100/200%), Compare toggle.
- Overlays: safe areas, thirds, focus point, camera path handles, onion skin.
- Preview quality toggle: Auto proxy ↔ Full.
- A/B viewer for comparing two versions or camera setups.

### Inspector (Right)
Context tabs auto-switch on selection (Scene, Beat, Clip). Each field labels inheritance and exposes "Reset to Scene defaults".
- **Scene**: name, duration, aspect, quality, render preset, default camera profile, default mood, default consistency locks.
- **Beat**: label, color, in/out, transition in/out, marker alignment.
- **Clip — Panel**: trim handles, speed (50–200%), consistency locks (characters, costumes, palette), prompt composer entry.
- **Clip — Camera**: shot template (establishing, dolly-in, parallax left/right, tilt, whip, handheld), intensity slider, easing, focus keyframes.
- **Clip — Prompt**: token chips + freeform, inheritance indicators, version history with A/B toggle.
- **Clip — FX**: overlay type, blend, intensity, ramp.
- **Clip — Audio**: mood bed picker, upload slot, waveform thumbnail, ducking toggles.

### Timeline (Bottom)
- Tracks share consistent heights (28–36 px) with colored accents: Panel=teal, Camera=cobalt, Prompt=amber, FX=midnight blue, Audio=green.
- Modes: Ripple vs Overwrite (global toggle on toolbar).
- Snapping: playhead, markers, clip edges (press ⌘ to temporarily disable).
- Trimming: drag edges; **Slip** (Alt+drag inside clip), **Slide** (Shift+drag entire clip while maintaining duration).
- Split (Blade) via B hotkey or toolbar icon.
- Markers: M to add, rename/color, jump with Shift+M / Option+M.
- Transitions: drag between Panel clips (Crossfade, Whip, Hold-to-Pan, Match-Cut on face).
- Track controls: mute, solo, lock, visibility toggles.
- Clip badges show stacked icons to indicate attached camera/prompt/FX quickly.
- Zoom slider + snapping toggle on right.

### Prompt Composer
- Structured tokens: [SHOT] [CAMERA MOVE] [MOOD] [LIGHTING] [STYLE] [ACTION] [CONSISTENCY LOCKS] + freeform text.
- Chips inherit from Scene defaults; overrides glow subtly and show ◁ icon for inherited state.
- Consistency locks reference canonical IDs (e.g., Zara#01 hair=curly-dark, Leo#02 bike=red, palette=page01).
- Generated prompt preview is read-only with Copy + "Edit advanced" button for raw text editing.
- Version history keeps last 10 edits; quick Variant A/B toggle.

## 4. Mobile Layout
```
┌──────────────────────────────────────────┐
│ Top: [Project ▾] [Page | Anim | Script] │
│ Player (tap to play/pause, scrub bar)    │
├──────────────────────────────────────────┤
│ Storyboard reel (h-scroll thumbnails)    │
├──────────────────────────────────────────┤
│ Bottom sheet timeline (drag up for full) │
│ • Tracks stack; show active + one more    │
│ • Long-press = split, drag edges = trim   │
│ • Pinch = zoom, two-finger drag = pan     │
├──────────────────────────────────────────┤
│ Inspector drawer (contextual tabs)       │
└──────────────────────────────────────────┘
```

### Mobile Gestures
- Tap player = play/pause; drag scrub bar to seek.
- Long-press clip = select; second long-press opens context menu (split, duplicate, delete).
- Drag edges = trim; pinch = zoom; two-finger drag = pan timeline.
- Swipe up bottom sheet to expand tracks; swipe down to collapse.
- Inspector drawer slides over timeline; tabs persist last context.

## 5. Render Queue
- Docked drawer to the right of timeline for constant visibility.
- Entries show thumbnail, Scene name, duration, preset, status (Queued, Rendering %, Complete, Error).
- Actions: Cancel, Retry, Duplicate, Compare (opens A/B viewer), "Reveal in project".
- Logs pane surfaces provider errors, prompt validation, rate-limit notes.
- Batch render mode: select multiple scenes → Render with preset.

## 6. Key Flows
**A) Build a scene fast**
1. Switch to Animation mode; create Scene 1 (defaults prefilled).
2. Drag 3 panels from Asset Browser into Panel track; thumbnails appear.
3. Select all clips → Inspector → Camera template = Parallax Pan, intensity 40%.
4. Prompt Composer: Medium shot + Warm nostalgia + Golden hour + Lock Leo#02 bike=red.
5. Space to preview; trim via handles; insert Crossfade between clip 1–2.
6. Press Render → choose Veo 3 1080p; watch progress in queue drawer.

**B) Consistency-first editing**
1. Scene Inspector → Consistency Locks → apply globally (Zara hair, device v2, palette page01).
2. New clips inherit locks; overrides glow with chip outline + tooltip.
3. Pre-render Consistency Check warns of conflicts ("Zara device mismatches v2 in clip 03; Fix all →").

**C) Mobile editing**
1. Tap Animation mode; drag bottom sheet up for timeline.
2. Long-press clip → Split; drag edges to trim; pinch to zoom timeline.
3. Swipe to Inspector drawer for prompts/camera tweaks.
4. Tap Render; queue slides in as toast card with progress.

## 7. Keyboard & Gesture Map
- Space: Play/Pause
- J/K/L: shuttle (back/pause/forward 1x, 2x)
- ←/→: step 1 frame (Shift = 10)
- B: Blade tool
- R: Render selected scenes
- M: Marker; Shift+M previous; Option+M next
- ⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z: Undo/Redo
- Option+Drag: duplicate clip
- Shift+Drag: slide clip
- Alt+Drag inside clip: slip timing
- S: snap toggle
- 1..5: track solo (Panel..Audio)
- `: toggle A/B compare
- Mobile gestures as defined in §4.

## 8. Visual Language
- Base aesthetic: warm cream foundation with graphite accents; UI elements borrow pro-editor clarity.
- Track colors: Panel teal (#1CA7A2), Camera cobalt (#1B4FB9), Prompt amber (#FFB437), FX midnight blue (#0A2140), Audio green (#1C8C4A).
- Selection: 2 px brand-accent glow.
- Inherited values show small chevron badge ◁.
- Typography: Inter or Söhne, 13/14 px for chrome, 16/18 px inspector, 12 px timeline labels.
- Spacing scale: 4/8/12/16/24; cards use 12 px padding; tracks 28–36 px tall.
- Icons: outline style, ≥ 40 px hit targets on mobile.
- Motion: 120–180 ms ease-out for selection/expansion; 240 ms for drawers.

## 9. Accessibility
- Minimum 4.5:1 contrast for text in tracks + inspector.
- Keyboard-navigable timeline: Tab between clips; ⌥←/→ jump to clip edges; Enter opens Inspector; Esc deselects.
- Reduced motion preference disables animated gizmos and timeline easing.

## 10. Performance & Tech Notes
- Virtualize panel library grid + timeline clips (react-virtualized / @tanstack/virtual).
- Timeline rendering via Canvas/WebGL for 60 fps scrubbing; thumbnails lazy-loaded.
- Editor state in Zustand/Jotai; command stack for undo/redo.
- Background workers generate thumbnails + proxies; WebSocket channel streams render queue updates.
- Autosave every 10 s and on window blur; recovery file for crash restore.

## 11. Data Model Sample
```json
{
  "projectId": "p_123",
  "defaults": {"aspect": "16:9", "preset": "veo3_1080", "quality": "cinematic"},
  "scenes": [
    {
      "sceneId": "s_1",
      "name": "Starlight Start-Up — Scene 1",
      "durationMs": 6000,
      "inherit": {"preset": true, "quality": true},
      "locks": {"characters": ["zara#01", "leo#02"], "palette": "page01"},
      "beats": [
        {
          "beatId": "b_1",
          "clips": {
            "panel": [
              {"panelId": "p1_panel1", "in": 0, "out": 1800},
              {"panelId": "p1_panel2", "in": 1800, "out": 3600}
            ],
            "camera": [
              {"type": "parallax_left", "in": 0, "out": 3600, "intensity": 0.4}
            ],
            "prompt": [
              {
                "in": 0,
                "out": 3600,
                "tokens": ["medium", "golden_hour", "warm"],
                "freeform": "lock Leo bike=red"
              }
            ],
            "fx": [],
            "audio": []
          }
        }
      ]
    }
  ]
}
```

## 12. Copy & Microcopy
- Empty timeline: "Drop panels here to start your first beat. Pro tip: press B to split, M to mark."
- Consistency warning: "Zara's device mismatches v2 lock in 1 clip. Fix all →"
- Render toast: "Queued 'Scene 1 — 6 s — Veo3 1080p'. View queue →"

## 13. Analytics
- Time-to-first-scene (drag panel → preview).
- Average trims/splits per minute (tool discoverability).
- % renders with ≥1 Prompt override (composer adoption).
- Mobile session completion rate for 6 s scene.

## 14. Roadmap
- **P0 (MVP)**: Bottom timeline (Panel + Prompt + Camera tracks), drag/drop, trim, split, ripple/overwrite, Inspector with Prompt Composer, basic render queue.
- **P1**: Transitions, markers, track mute/solo/lock, prompt versioning + A/B, consistency check, docked render drawer.
- **P2**: On-canvas keyframe gizmos, FX track, audio ducking, side-by-side compare, batch render presets, tutorial overlays.

---
Ready for wireframing and component inventory.
