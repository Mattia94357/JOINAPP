export type ValidatedImage = {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
};

export class ImageInputError extends Error {
  status = 400;
}

const dimensions = (buffer: Buffer, mimeType: ValidatedImage['mimeType']) => {
  if (mimeType === 'image/png') {
    if (buffer.length < 33 || buffer.toString('ascii', 12, 16) !== 'IHDR'
      || buffer.toString('ascii', buffer.length - 8, buffer.length - 4) !== 'IEND') return;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === 'image/webp') {
    if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF'
      || buffer.toString('ascii', 8, 12) !== 'WEBP' || buffer.readUInt32LE(4) + 8 !== buffer.length) return;
    const kind = buffer.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (kind === 'VP8L' && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    return;
  }
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8
    || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
};

export const decodeImageDataUri = (value: unknown, maxBytes: number): ValidatedImage => {
  if (typeof value !== 'string') throw new ImageInputError('Upload a JPEG, PNG, or WEBP image.');
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ImageInputError('Upload a JPEG, PNG, or WEBP image. Remote image URLs are not accepted.');
  const estimated = Math.floor((match[2].length * 3) / 4);
  if (estimated > maxBytes) throw new ImageInputError(`Image must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller.`);
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > maxBytes || buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) {
    throw new ImageInputError('The image data is invalid.');
  }
  let mimeType: ValidatedImage['mimeType'] | undefined;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) mimeType = 'image/jpeg';
  else if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mimeType = 'image/png';
  else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') mimeType = 'image/webp';
  const declared = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  if (!mimeType || declared !== mimeType) throw new ImageInputError('The file contents do not match a supported JPEG, PNG, or WEBP image.');
  const size = dimensions(buffer, mimeType);
  if (!size?.width || !size.height || size.width > 12000 || size.height > 12000) throw new ImageInputError('The image is damaged or has unsupported dimensions.');
  return { buffer, mimeType, extension: mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] as 'png' | 'webp', ...size };
};
