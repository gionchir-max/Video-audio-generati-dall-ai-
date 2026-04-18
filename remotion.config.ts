import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(8);
// Preset x264 più veloce: impatto qualità trascurabile, −30/40% sul tempo di encode
Config.setX264Preset('faster');
// WebGL renderer necessario per MapLibre GL in MapVideo composition
Config.setChromiumOpenGlRenderer('swangle');
