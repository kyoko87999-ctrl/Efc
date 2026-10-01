// Shared skeleton constants (metres, character scale 1).  Mesh space: +Z forward, +Y up, +X = character's LEFT.
// Pose space (authoring): [side (+right), up, forward].
export const LEN = { thigh: 0.44, shin: 0.43, upper: 0.315, fore: 0.29 };
export const ANKLE_H = 0.07;          // ankle joint height above the sole
export const HEEL_Z = -0.06;          // heel / ball of foot relative to the ankle (forward = +)
export const BALL_Z = 0.125;
export const HIP_X = 0.09, HIP_Y = -0.06;
export const SPINE_Y = 0.10, CHEST_Y = 0.24, NECK_Y = 0.30;
export const SH_X = 0.20, SH_Y = 0.22 + 0.11 - 0.01;   // shoulder joint position in chest space
export const HEAD_Y = 0.13;
export const ARM_REACH = LEN.upper + LEN.fore;
export const LEG_REACH = LEN.thigh + LEN.shin;
export const STAND_HIPS = 0.90;
