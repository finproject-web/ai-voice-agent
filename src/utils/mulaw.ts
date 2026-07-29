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

  // Add the bias by OR-ing
  pcm |= BIAS;
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

export function linearToMuLaw(sample: number): number {
  return muLawTable[sample + 32768];
}

export function convertPcmToMulaw(
  pcmBuffer: Buffer,
  inputSampleRate = 24000,
  outputSampleRate = 8000
): Buffer {
  const inputLength = Math.floor(pcmBuffer.length / 2);
  const inputSamples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, inputLength);

  const ratio = Math.round(inputSampleRate / outputSampleRate);
  const outputLength = Math.floor(inputLength / ratio);
  const mulawBuffer = Buffer.alloc(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const base = i * ratio;
    let sum = 0;
    let count = 0;
    for (let j = 0; j < ratio && (base + j) < inputLength; j++) {
      sum += inputSamples[base + j];
      count++;
    }
    const avg = count > 0 ? Math.round(sum / count) : 0;
    mulawBuffer[i] = muLawTable[avg + 32768];
  }

  return mulawBuffer;
}
