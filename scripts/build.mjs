// Bundles the game with esbuild.  Outputs:
//   dist/index.html + dist/game.js   (multi-file, for any static host)
//   dist/efc.html                    (single self-contained file: open by double-click / upload anywhere)
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const dev = process.argv.includes('--dev') || watch;
mkdirSync('dist', { recursive: true });

const opts = {
  entryPoints: { game: 'src/main.js', debug: 'src/debug.js' },
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outdir: 'dist',
  minify: !dev,
  sourcemap: dev,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
  logLevel: 'info',
};

function html(inlineJs) {
  const tpl = readFileSync('src/index.template.html', 'utf8');
  const script = inlineJs ? `<script>\n${inlineJs.replace(/<\/script>/gi, '<\\/script>')}\n</script>` : '<script src="game.js"></script>';
  const css = readFileSync('src/style.css', 'utf8');
  return tpl.replace('/*STYLE*/', () => css).replace('<!--GAME_SCRIPT-->', () => script);
}

async function emit() {
  const js = readFileSync('dist/game.js', 'utf8');
  writeFileSync('dist/index.html', html(null));
  writeFileSync('dist/efc.html', html(js));
  writeFileSync('dist/debug.html', html(null).replace('game.js', 'debug.js'));
  console.log(`built: game.js ${(js.length / 1024).toFixed(0)} KB, efc.html ${(readFileSync('dist/efc.html').length / 1024).toFixed(0)} KB`);
}

if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'emit', setup(b) { b.onEnd(() => { emit(); }); } }] });
  await ctx.watch();
  console.log('watching...');
} else {
  await build(opts);
  await emit();
}
