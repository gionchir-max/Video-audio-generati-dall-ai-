import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(4);
// WebGL renderer necessario per MapLibre GL in MapVideo composition
Config.setChromiumOpenGlRenderer('swangle');
