export type EqType = "P" | "LS" | "HS" | string;

export interface EqBand {
  index: number;
  typeRaw: number;
  type: EqType;
  frequencyHz: number;
  q: number;
  gainDb: number;
}

export interface EqCrossover {
  lpTypeRaw: number;
  lpType: string;
  lpfHz: number;
  hpTypeRaw: number;
  hpType: string;
  hpfHz: number;
}

export interface EqSection {
  key: string;
  label: string;
  offset: number;
  enabledFlag: number;
  bands: EqBand[];
  crossover: EqCrossover;
}

export interface CompFields {
  compThresholdDb: number;
  compRatio: number;
  attackMs: number;
  releaseSec: number;
}

export interface Preset {
  bytes: Uint8Array;
  length: number;
  name: string;
  checksum: number;
  checksumOk: boolean;
  system: {
    topMusicVol: number;
    topMicVol: number;
    topEffectVol: number;
    musicInitVol: number;
    musicMaxVol: number;
    micInitVol: number;
    micMaxVol: number;
    effectInitLevel: number;
    uDiskRecordVol: number;
    usbRecordVol: number;
    deviceModeIndex: number;
    deviceModeNames: string[];
    btName: string;
    bleName: string;
    danceMicThresholdDb: number;
    danceMicTimeSec: number;
  };
  mic: {
    micAVol: number;
    micBVol: number;
    noiseGateDb: number;
    eqLink: boolean;
    hpfHz: number;
    lpfHz: number;
  } & CompFields;
  music: {
    sourceRaw: number;
    source: string;
    key: number;
    input1GainDb: number;
    input2GainDb: number;
    btGainDb: number;
    uDiskGainDb: number;
    digitalGainDb: number;
    noiseGateDb: number;
    bassDb: number;
    midDb: number;
    midFreqHz: number;
    trebleDb: number;
  };
  outputs: {
    main: {
      lVolDb: number; rVolDb: number;
      micDirect: number; musicLevel: number; reverbLevel: number; echoLevel: number;
    } & CompFields;
    surround: {
      lVolDb: number; rVolDb: number;
      micDirect: number; musicLevel: number; reverbLevel: number; echoLevel: number;
      lDelayMs: number; rDelayMs: number;
    } & CompFields;
    center: {
      outputVolDb: number;
      micDirect: number; musicLevel: number; reverbLevel: number; echoLevel: number;
    } & CompFields;
    sub: {
      outputVolDb: number;
      micDirect: number; musicLevel: number; reverbLevel: number; echoLevel: number;
      hpfHz: number; lpfHz: number;
    } & CompFields;
  };
  effects: {
    reverb: { level: number; hpfHz: number; lpfHz: number; decayMs: number; predelayMs: number };
    echo: { level: number; repeat: number; hpfHz: number; lpfHz: number; leftDelayMs: number };
  };
  eq: Record<string, EqSection>;
}

export type PageKey =
  | "mic" | "music" | "main" | "surround" | "center" | "sub" | "reverb" | "echo" | "system";
