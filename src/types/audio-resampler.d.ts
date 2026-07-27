declare module 'audio-resampler' {
  export class Resampler {
    constructor(fromSampleRate: number, toSampleRate: number, channels: number);
    resample(buffer: Float32Array): Float32Array;
  }
}
