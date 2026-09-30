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

// Artifact-hosting variant: the host wraps the page in its own <!doctype>/<head>/<body>, so emit only the fragment.
function artifactHtml(inlineJs) {
  const css = readFileSync('src/style.css', 'utf8');
  const tpl = readFileSync('src/index.template.html', 'utf8');
  const body = tpl.slice(tpl.indexOf('<div id="app">'), tpl.indexOf('<!--GAME_SCRIPT-->'));
  return `<title>Elite Fighters Championship</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kanit:ital,wght@0,400;0,600;0,800;1,800&family=Rajdhani:wght@500;600;700&display=swap">
<style>
  /* single dark look: the game is a night-time arena, so it keeps its own palette in both host themes */
  :root { color-scheme: dark; --ground: #07080c; }
  html, body { margin: 0; height: 100%; background: var(--ground); overflow: hidden; color: #fff; }
  #app { position: fixed; inset: 0; }
  canvas#gl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
<style>
${css}
</style>
${body}<script>
${inlineJs.replace(/<\/script>/gi, '<\\/script>')}
</script>
`;
}

async function emit() {
  const js = readFileSync('dist/game.js', 'utf8');
  writeFileSync('dist/index.html', html(null));
  writeFileSync('dist/efc.html', html(js));
  writeFileSync('dist/artifact.html', artifactHtml(js));
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
