// audioWorker.js
import './external/fili/dist/fili.js';
import 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';

import {filterService} from "./filterService.js";

const maxINT16 = 32767;

// Worker script - handle incoming messages
self.onmessage = async function(e) {
    const signal = e.data;
    const clippedAudio = await calculateClipRange(signal);
    self.postMessage(clippedAudio);
};

async function calculateClipRange(signal) {
    const filteredSignal = filterService.filterSignal(signal, 'audio');
    // Calculate signal statistics for normalization
    const scale = getScaleFactor(filteredSignal);
    // Convert signal to INT16 audio samples
    return buildClippedSignal(filteredSignal, scale);
}

function getScaleFactor(signal) {
    return maxINT16 / d3.quantile(signal, 0.85);
}

function buildClippedSignal(signal, scale) {
    const clippedAudio = new Int16Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
        const value = Math.round(signal[i] * scale);
        const clipped = value > maxINT16 ? maxINT16 : value < -maxINT16 ? -maxINT16 : value;
        clippedAudio[i] = clipped;
    }
    return clippedAudio;
}