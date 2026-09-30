export const FPS = 60;
export const HP_MAX = 180;
export const RAGE_FRAC = 0.25;
export const G = 0.0052;             // gravity, m per frame^2
export const BODY_R = 0.30;         // fighter body radius (m at scale 1)
export const BASE_H = 1.8;          // standing height at scale 1
export const CROUCH_H = 1.05;
export const START_DIST = 2.7;
export const CHORD_WINDOW = 2;      // frames in which button presses count as one chord
export const CMD_BUFFER = 9;        // frames a command stays buffered
export const DASH_WINDOW = 12;
export const HEAT_FRAMES = 600;     // 10 seconds
export const THROW_BREAK_WIN = 16;
export const HIST_LEN = 96;

// buttons: bit masks (1 = LP, 2 = RP, 3 = LK, 4 = RK)
export const B1 = 1, B2 = 2, B3 = 4, B4 = 8;
export const LAUNCH_MUL = 0.84;    // scales every launcher's vertical speed (tuning knob)
