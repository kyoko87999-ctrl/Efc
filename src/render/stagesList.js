// Stage definitions (sim data): arena bounds, walls, wall-break phases.
export const STAGES = [
  {
    id: 'rooftop', name: 'Neon Rooftop', nameTH: 'ดาดฟ้านีออน', desc: 'A rain-slicked skyscraper roof above a glowing city.', music: 'rooftop', theme: '#ff5fa2',
    phases: [{ bounds: { type: 'rect', hx: 8, hz: 6 }, walls: { px: true, nx: true, pz: true, nz: true } }],
  },
  {
    id: 'dojo', name: 'Moonlit Dojo', nameTH: 'โดโจใต้แสงจันทร์', desc: 'Shoji walls hide a moonlit garden - break through to fight on.', music: 'dojo', theme: '#7fb5ff',
    phases: [
      { bounds: { type: 'rect', hx: 8, hz: 5.5 }, walls: { px: true, nx: true, pz: true, nz: true }, wallBreak: 'px' },
      { bounds: { type: 'circle', r: 7.5 }, walls: { all: false }, center: [30, 0] },
    ],
  },
  {
    id: 'temple', name: 'Sunken Temple', nameTH: 'วิหารใต้พิภพ', desc: 'Ancient stone ring lit by torches.', music: 'temple', theme: '#ffb347',
    phases: [{ bounds: { type: 'circle', r: 7.5 }, walls: { all: true } }],
  },
  {
    id: 'alley', name: 'Neon Alley', nameTH: 'ตรอกนีออน', desc: 'A narrow back street. Walls everywhere.', music: 'alley', theme: '#31e6ff',
    phases: [{ bounds: { type: 'rect', hx: 10, hz: 3.6 }, walls: { px: true, nx: true, pz: true, nz: true } }],
  },
  {
    id: 'volcano', name: 'Volcano Rim', nameTH: 'ปากปล่องภูเขาไฟ', desc: 'A basalt platform above a sea of lava.', music: 'volcano', theme: '#ff6a3d',
    phases: [{ bounds: { type: 'circle', r: 8 }, walls: { all: false } }],
  },
  {
    id: 'ring', name: 'Bangkok Fight Night', nameTH: 'เวทีมวยกรุงเทพ', desc: 'A packed boxing stadium under the spotlights.', music: 'ring', theme: '#ffd23f',
    phases: [{ bounds: { type: 'rect', hx: 5.6, hz: 5.6 }, walls: { px: true, nx: true, pz: true, nz: true } }],
  },
  {
    id: 'ice', name: 'Frozen Peak', nameTH: 'ยอดเขาน้ำแข็ง', desc: 'Aurora skies over a frozen summit.', music: 'ice', theme: '#9fe8ff',
    phases: [{ bounds: { type: 'circle', r: 8 }, walls: { all: false } }],
  },
  {
    id: 'throne', name: 'Demon Throne', nameTH: 'บัลลังก์อสูร', desc: 'The final stage. Chaos rains from the sky.', music: 'throne', theme: '#c13bff',
    phases: [{ bounds: { type: 'circle', r: 8.5 }, walls: { all: true } }],
  },
  {
    id: 'grid', name: 'Training Grid', nameTH: 'ลานฝึก', desc: 'Neutral training space.', music: 'grid', theme: '#66ff99', hidden: false,
    phases: [{ bounds: { type: 'rect', hx: 9, hz: 7 }, walls: { px: true, nx: true, pz: true, nz: true } }],
  },
];

export const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

