export class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  currentTime = 100
  state: AudioContextState = "running"
  destination: AudioDestinationNode = {} as AudioDestinationNode

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  resume(): Promise<void> {
    this.state = "running"
    return Promise.resolve()
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = {
      buffer: null,
      connect: () => source,
      start: () => {},
      stop: () => {},
      onended: null,
    }
    return source as unknown as AudioBufferSourceNode
  }

  createGain(): GainNode {
    const gain = {
      connect: () => gain,
      gain: {
        value: 1,
        setValueAtTime: () => gain.gain,
        linearRampToValueAtTime: () => gain.gain,
        setTargetAtTime: () => gain.gain,
        cancelScheduledValues: () => gain.gain,
      },
    }
    return gain as unknown as GainNode
  }

  createBiquadFilter(): BiquadFilterNode {
    const filter = {
      type: "lowpass",
      frequency: { value: 9000 },
      Q: { value: 0.707 },
      connect: () => filter,
    }
    return filter as unknown as BiquadFilterNode
  }

  decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 0.5 } as AudioBuffer)
  }
}
