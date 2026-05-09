const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'src', 'assets', 'icons');

function createPngIcon(size, outputPath) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  const width = size;
  const height = size;
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); 
  ihdrData.writeUInt8(6, 9); 
  ihdrData.writeUInt8(0, 10); 
  ihdrData.writeUInt8(0, 11); 
  ihdrData.writeUInt8(0, 12); 
  
  const crc32 = require('zlib').crc32 || (() => {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    return (buf) => {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };
  })();

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    
    return Buffer.concat([length, typeAndData, crc]);
  }

  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const cx = x - width / 2;
      const cy = y - height / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const maxDist = width / 2 - 2;
      
      if (dist < maxDist) {
        const t = dist / maxDist;
        const r = Math.round(76 + (255 - 76) * t);
        const g = Math.round(175 - (175 - 69) * t);
        const b = Math.round(80 + (255 - 80) * t);
        rawData.push(r, g, b, 255);
      } else {
        rawData.push(0, 0, 0, 0);
      }
    }
  }

  const rawBuffer = Buffer.from(rawData);
  const compressed = require('zlib').deflateSync(rawBuffer);
  const idatChunk = createChunk('IDAT', compressed);
  
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  const png = Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
  
  fs.writeFileSync(outputPath, png);
  console.log(`Created: ${outputPath}`);
}

createPngIcon(16, path.join(iconsDir, 'icon16.png'));
createPngIcon(48, path.join(iconsDir, 'icon48.png'));
createPngIcon(128, path.join(iconsDir, 'icon128.png'));

console.log('Icons created successfully!');
