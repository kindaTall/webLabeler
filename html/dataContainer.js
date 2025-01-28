import { api } from './api.js';
import {filterService} from './filterService.js';

function formatKey(base, index) {
    return `${base}.${index}`;
}

function labelKey(index) {
    return formatKey("labels", index);
}

function probabilityKey(index) {
    return formatKey("probabilities", index);
}



class DataContainer {
    constructor(filename, signal, yConfigs, probabilities) {
        if (signal.length !== yConfigs[0].ubs.at(-1)) {
            throw new Error("Length of signal and yConfig.ubs must be equal");
        }

        this.filename = filename;
        this.signal = SignalProcessor.zeroMean(signal);
        this.yConfigs = yConfigs.map(DataContainer.fixYConfig);
        this.probabilities = probabilities;

        const labels = yConfigs.map(YConfigProcessor.yConfigToArray);
        this.dataLong = DataContainer.calculateDataContainer(this.signal, labels);
        this.dataTransformed = DataContainer.calculateDataContainerTransformed( probabilities, this.signal );
        this.metaData = new Map();
    }


    getMetaData(key) {
        if (!this.metaData.has(key)) {
            this.metaData.set(key, this.calculateMetaData(key));
        }
        return this.metaData.get(key);
    }

    calculateMetaData(key) {
        if (key.startsWith('labels.')) {
            return {min: -1, max: 1};
        }
        if (key.startsWith('probabilities.')) {
            return {min: -1, max: 1};
        }
        if (key === 'signal') {
            return SignalProcessor.calculateMetaDataFromArray(this.signal);
        }
        if (key === 'integral') {
            return SignalProcessor.calculateMetaDataFromArray(this.dataLong.integral);
        }
        if (key === 'noise') {
            return SignalProcessor.calculateMetaDataFromArray(this.dataTransformed.noise);
        }
        throw new Error(`Unknown key: ${key}`);
    }

    static fixYConfig(yConfig) {
        return {
            ...yConfig,
            labels: yConfig.labels.map(label =>
                (label === undefined || label === null) ? -1 : label
            )
        };
    }

    getContainer(key) {
        if (key.startsWith("probabilities.") || key === "noise") {
            return this.dataTransformed;
        }
        return this.dataLong;
    }

    static calculateDataContainer(signal, labels) {
        const time = new Float32Array(signal.length);
        for (let i = 0; i < signal.length; i++) {
            time[i] = i / 1395;
        }

        const data = {
            time: time,
            signal: signal,
            integral: SignalProcessor.cumsum(signal)
        };

        labels.forEach((label, i) => {
            data[labelKey(i)] = label;
        });

        return data;
    }

    static calculateDataContainerTransformed(probabilities, signal) {
        const timeIncr = 512 / 1395;
        let timeItr = 8191 / 1395;

        const time = new Float32Array(probabilities[0].length);
        for (let i = 0; i < time.length; i++) {
            time[i] = timeItr;
            timeItr += timeIncr;
        }

        const noise = SignalProcessor.calculateNoise(signal);

        const data = { time, noise };
        probabilities.forEach((prob, i) => {
            data[probabilityKey(i)] = prob;
        });

        return data;
    }

    updateLabels(index, start, end, label) {
        label = label === 0.5 ? -1 : label;
        let changes = false;
        [start, end] = start < end ? [start, end] : [end, start];
        const key = labelKey(index);

        for (let i = Math.max(0, start); i < Math.min(end, this.dataLong[key].length); i++) {
            if (this.dataLong[key][i] !== label) {
                changes = true;
                this.dataLong[key][i] = label;
            }
        }

        if (changes) {
            this.yConfigs[index] = YConfigProcessor.ArrayToYConfig(this.dataLong, labelKey(index));
            api.updateLabels(this.filename, this.yConfigs);
        }
    }
}


class YConfigProcessor {
    static ArrayToYConfig(array, key) {
        const values = array[key];
        const ubs = [];
        const labels = [];
        let prev = values[0];

        for (let i = 1; i < values.length; i++) {
            if (values[i] !== prev) {
                ubs.push(i);
                labels.push(prev);
                prev = values[i];
            }
        }

        ubs.push(values.length);
        labels.push(prev);
        return {ubs, labels};
    }

    static yConfigToArray(yConfig) {
        const result = new Array(yConfig.ubs[yConfig.ubs.length - 1]).fill(null);

        for (let i = 0; i < yConfig.labels.length; i++) {
            const lb = i === 0 ? 0 : yConfig.ubs[i - 1];
            const ub = yConfig.ubs[i];
            result.fill(yConfig.labels[i], lb, ub);
        }
        return result;
    }
}


class SignalProcessor {
    static zeroMean(signal) {
        const mean = SignalProcessor.mean(signal);
        for (let i = 0; i < signal.length; i++) {
            signal[i] -= mean;
        }
        return signal;
    }

    static mean(array){
        let sum = 0;
        for (let i = 0; i < array.length; i++){
            sum += array[i];
        }
        return sum / array.length;
    }

    static cumsum(array){
        const result = new (array.constructor)(array.length);
        let sum = result[0] = array[0];
        for (let i = 0; i < array.length; i++){
            sum += array[i];
            result[i] = sum;
        }
        return result;
    }

    static calculateNoise(signal, length=2048, step=512, firstWindow=8192) {
        const filtered = filterService.filterSignal(signal, 'noise');

        const subResult = new Float64Array(Math.floor((signal.length - step) / step + 1));
        for (let i = 0; i < subResult.length; i++) {
            subResult[i] = d3.deviation(filtered.slice(i * step, i * step + step));
        }

        const result = new Float64Array(Math.floor((signal.length - firstWindow) / step + 1));
        const slidingWindowSize = length / step;
        const offset = firstWindow / step;
        for (let i = 0; i < result.length; i++) {
            result[i] = SignalProcessor.mean(subResult.slice(i+offset-slidingWindowSize, i + offset));
        }
        return result;
    }

    static calculateMetaDataFromArray(array) {
        return {min: d3.min(array), max: d3.max(array)}
    }
}


export { DataContainer };