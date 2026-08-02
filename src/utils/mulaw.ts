import logger from '../config/logger';

const BIAS = 0x84;
const CLIP = 0x7fff;
const SEG_UEND = [0x3f, 0x7f, 0xff, 0x1ff, 0x3ff, 0x7ff, 0xfff, 0x1fff];

function encodeLinearToMuLaw(pcm: number): number {
  // Handle -32768 by changing to -32767
  if (pcm === -32768) {
    pcm = -32767;
  }

  let mask: number;
  if (pcm < 0) {
    pcm = -pcm;
    mask = 0x7f;
  } else {
    mask = 0xff;
  }

  // Add the bias (must be an arithmetic addition per the G.711 mu-law spec,
  // not a bitwise OR — OR-ing corrupts the amplitude curve for any magnitude
  // that already has overlapping bits with BIAS, producing audible
  // distortion/muffling instead of the correct logarithmic compression).
  pcm += BIAS;
  if (pcm > CLIP) {
    pcm = CLIP;
  }

  const shifted = pcm >> 4;
  let seg = 0;
  while (seg < 8 && shifted > SEG_UEND[seg]) {
    seg++;
  }

  if (seg >= 8) {
    return 0x7f ^ mask;
  }

  const uval = (seg << 4) | ((pcm >> (seg + 3)) & 0x0f);
  return uval ^ mask;
}

// Build a 65536-entry lookup table once at startup
function buildMuLawTable(): Uint8Array {
  const table = new Uint8Array(65536);
  for (let pcm = -32768; pcm <= 32767; pcm++) {
    table[pcm + 32768] = encodeLinearToMuLaw(pcm);
  }
  return table;
}

const muLawTable = buildMuLawTable();

const filterCache = new Map<string, { step: number; half: number; coeffs: Float64Array }>();

function getDecimationFilter(inputSampleRate: number, outputSampleRate: number) {
  const key = `${inputSampleRate}:${outputSampleRate}`;
  if (filterCache.has(key)) {
    return filterCache.get(key)!;
  }

  const step = Math.round(inputSampleRate / outputSampleRate);
  if (step < 1) {
    throw new Error(`Invalid resampling ratio: ${inputSampleRate} -> ${outputSampleRate}`);
  }

  const cutoff = (outputSampleRate * 0.45) / inputSampleRate;
  const taps = Math.max(31, step * 10 + 1);
  const half = Math.floor(taps / 2);
  const coeffs = new Float64Array(taps);
  let sum = 0;

  for (let i = 0; i < taps; i++) {
    const n = i - half;
    const sinc = n === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n);
    const hamming = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (taps - 1));
    const c = sinc * hamming;
    coeffs[i] = c;
    sum += c;
  }

  if (Math.abs(sum) > 1e-9) {
    for (let i = 0; i < taps; i++) {
      coeffs[i] /= sum;
    }
  }

  const result = { step, half, coeffs };
  filterCache.set(key, result);
  return result;
}

export function linearToMuLaw(sample: number): number {
  return muLawTable[sample + 32768];
}

export function convertPcmToMulaw(
  pcmBuffer: Buffer,
  inputSampleRate = 24000,
  outputSampleRate = 8000
): Buffer {
  const inputLength = Math.floor(pcmBuffer.length / 2);
  if (inputLength === 0) {
    return Buffer.alloc(0);
  }

  // Read as signed 16-bit little-endian PCM explicitly; do not rely on host Int16Array endianness.
  const inputSamples = new Int16Array(inputLength);
  for (let i = 0; i < inputLength; i++) {
    inputSamples[i] = pcmBuffer.readInt16LE(i * 2);
  }

  const { step, half, coeffs } = getDecimationFilter(inputSampleRate, outputSampleRate);
  const outputLength = Math.floor(inputLength / step);

  // Pad with zeros so every output position has a full, centered filter window.
  const padded = new Int16Array(inputLength + 2 * half);
  for (let i = 0; i < inputLength; i++) {
    padded[i + half] = inputSamples[i];
  }

  const output = new Int16Array(outputLength);
  let minSample = 0;
  let maxSample = 0;

  for (let m = 0; m < outputLength; m++) {
    const center = half + m * step;
    let sum = 0;
    for (let k = 0; k < coeffs.length; k++) {
      sum += padded[center - half + k] * coeffs[k];
    }
    const sample = Math.max(-32768, Math.min(32767, Math.round(sum)));
    output[m] = sample;
    if (sample < minSample) minSample = sample;
    if (sample > maxSample) maxSample = sample;
  }

  const mulawBuffer = Buffer.alloc(outputLength);
  for (let i = 0; i < outputLength; i++) {
    mulawBuffer[i] = muLawTable[output[i] + 32768];
  }

  logger.info('PCM resampled for μ-law', {
    inputSampleRate,
    outputSampleRate,
    inputSamples: inputLength,
    outputSamples: outputLength,
    decimationStep: step,
    filterTaps: coeffs.length,
    outputMinSample: minSample,
    outputMaxSample: maxSample,
    mulawBytes: mulawBuffer.length,
  });

  return mulawBuffer;
}
