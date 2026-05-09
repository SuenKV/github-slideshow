import * as esbuild from 'esbuild';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.argv.includes('--dev');

const buildOptions = {
  entryPoints: [
    'src/background/service-worker.js',
    'src/background/ffmpeg-manager.js',
    'src/background/download-manager.js',
    'src/popup/popup.js'
  ],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  splitting: true,
  sourcemap: isDev,
  minify: !isDev,
  target: ['chrome110'],
  platform: 'browser',
  external: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  logLevel: 'info'
};

async function build() {
  console.log('Starting build...');

  try {
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }

    if (!fs.existsSync('dist/lib')) {
      fs.mkdirSync('dist/lib', { recursive: true });
    }

    console.log('Building JavaScript files...');
    await esbuild.build(buildOptions);

    console.log('Copying static files...');

    const staticFiles = [
      { src: 'manifest.json', dest: 'dist/manifest.json' },
      { src: 'popup/popup.html', dest: 'dist/popup/popup.html' },
      { src: 'popup/popup.css', dest: 'dist/popup/popup.css' },
      { src: 'content/video-scanner.js', dest: 'dist/content/video-scanner.js' },
      { src: 'shared/constants.js', dest: 'dist/shared/constants.js' },
      { src: 'shared/utils.js', dest: 'dist/shared/utils.js' }
    ];

    for (const file of staticFiles) {
      const srcPath = path.join('src', file.src);
      const destPath = path.join('dist', file.dest);

      if (fs.existsSync(srcPath)) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
        console.log(`  Copied: ${file.src}`);
      }
    }

    if (fs.existsSync('assets')) {
      copyDirectory('assets', 'dist/assets');
    }

    if (fs.existsSync('_locales')) {
      copyDirectory('_locales', 'dist/_locales');
    }

    console.log('Build completed successfully!');

    if (isDev) {
      console.log('\nWatching for changes...');
      const ctx = await esbuild.context({
        ...buildOptions,
        watch: true
      });
      ctx.watch();
    }

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${srcPath}`);
    }
  }
}

async function packageExtension(outputName = 'video-cache-downloader.zip') {
  return new Promise((resolve, reject) => {
    console.log(`Packaging extension as ${outputName}...`);

    const output = fs.createWriteStream(outputName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Package created: ${outputName} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory('dist', false);
    archive.finalize();
  });
}

build().then(() => {
  if (!isDev) {
    packageExtension();
  }
}).catch(console.error);

export { build, packageExtension };
