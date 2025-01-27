import { api } from './api.js';

function formatKey(base, index){
    return `${base}.${index}`;
}

function labelKey(index){
    return formatKey("labels", index);
}

function probabilityKey(index){
    return formatKey("probabilities", index);
}


function buildPreload(filename, signal, yConfigs, probabilities){
    // most expensive is building noise. only precalculate noise.
    const noiseArray = Array.from(DataContainer.generateNoise(signal, d3.mean(signal), 8192));

    yConfigs = yConfigs.map(DataContainer.fixYConfig);

    const metaData = new Map();
    metaData['signal'] = DataContainer.calculateMetaDataFromArray(signal);
    metaData['noise'] = DataContainer.calculateMetaDataFromArray(noiseArray);
    for (let i = 0; i < yConfigs.length; i++) {
        metaData[labelKey(i)] = {min: -1, max: 1};
        metaData[probabilityKey(i)] = {min: -1, max: 1};
    }

    return {x: signal, label: yConfigs, p: probabilities, noise: noiseArray, metaData: metaData};
}


class DataContainer {
    constructor(filename, signal, yConfigs, probabilities, noiseArray=null, metaData=null){
        if (signal.length !== yConfigs[0].ubs.at(-1)){
            throw new Error("Length of signal and yConfig.ubs must be equal");
        }
        this.filename = filename;
        this.signal = signal;
        this.yConfigs = yConfigs.map(DataContainer.fixYConfig);;
        this.probabilities = probabilities;

        const labels = yConfigs.map(DataContainer.yConfigToArray);
        this.unified = DataContainer.calculateUnified(signal, labels, noiseArray);
        this.unifiedProbabilities = DataContainer.calculateUnifiedProbabilites(probabilities);
        this.metaData = metaData || new Map();
    }

    getMetaData(key){
        if (!this.metaData.has(key)){
            this.metaData.set(key, this.calculateMetaData(key));
        }
        return this.metaData.get(key);
    }

    calculateMetaData(key){
        if (key.startsWith('labels.')){
            const index = parseInt(key.split(".")[1]);
            return {min: -1, max: 1};
        }
        if (key.startsWith('probabilities.')){
            return {min: -1, max: 1};
        }
        if (key === 'signal'){
            return DataContainer.calculateMetaDataFromArray(this.signal);
        }
        for(const base of ['integral', 'noise']){
            if (key === base){
                return DataContainer.calculateMetaDataFromArray(this.unified, base);
            }
        };
        throw new Error(`Unknown key: ${key}`);
    }

    static fixYConfig(yConfig){
        for (let i = 0; i < yConfig.labels.length; i++){
            yConfig.labels[i] = (yConfig.labels[i] === undefined  || yConfig.labels === null) ? -1 : yConfig.labels[i];
        }
        return yConfig;
    }

    static calculateMetaDataFromArray(array, accessor=undefined){
        if (!accessor ){
            return {min: d3.min(array), max: d3.max(array)};
        }
        return {min: d3.min(array, (d) => d[accessor]), max: d3.max(array, (d) => d[accessor])};
    }

    getContainer(key) {
         if (key.startsWith("probabilities.")){
            return this.unifiedProbabilities;
         }
         // key is signal, integral, noise, or labels.<i>
         return this.unified;
    }

    static calculateUnified(signal, labels, noiseArray=null) {
        const mean = d3.mean(signal);
        const integralIter = DataContainer.generateIntegral(signal, mean);
        const noiseIter = noiseArray ? noiseArray.values() : DataContainer.generateNoise(signal, mean);

        // Convert labels array to object with numbered keys
        const labelObj = labels.reduce((acc, label, i) => ({
           ...acc,
           [labelKey(i)]: label
        }), {});

        let data = new Array(signal.length);
        for(let i = 0; i < signal.length; i++) {
            data[i] = {
               time: i / 1395,
               signal: signal[i],
               integral: integralIter.next().value,
               noise: noiseIter.next().value,
            };
            for (let j = 0; j < labels.length; j++) {
                data[i][labelKey(j)] = labels[j][i];
            }
        }
        return data;
    }

    static calculateUnifiedProbabilites(probabilities) {
        let data = new Array(probabilities[0].length);

        for (let i = 0; i < probabilities[0].length; i++) {
            data[i] = {
                time: (i * 512 + 8191) / 1395 ,
                ...probabilities.reduce((acc, arr, j) => ({
                    ...acc,
                    [probabilityKey(j)]: arr[i]
                }), {})
            };
        }
        return data;
    }


    updateLabels(index, start, end, label){
        label = label == 0.5 ? -1 : label;
        let changes = false;
        [start, end] = (start < end) ? [start, end] : [end, start];
        const key = labelKey(index);


        for (let i = Math.max(0, start); i < Math.min(end, this.unified.length); i++) {
            if (this.unified[i][key] !== label){
                changes = true;
                this.unified[i][key] = label;
            }
        }
        if (!changes){
            return;
        }
        this.updateAndSendLabels(index);
    }

    async updateAndSendLabels(index) {
        this.yConfigs[index] = DataContainer.ArrayToYConfig(this.unified, labelKey(index));
        api.updateLabels(this.filename, this.yConfigs);
    }

    static ArrayToYConfig(array, key) {
        let ubs = [];
        let labels = [];
        let prev = array[0][key];

        for (let i = 1; i < array.length; i++) {
            if (array[i][key] !== prev){
                ubs.push(i);
                labels.push(prev);
                prev = array[i][key];
            }
        }
        ubs.push(array.length);
        labels.push(prev);
        return {ubs, labels};
    }

    static yConfigToArray(yConfig){
        let result = new Array(yConfig.ubs[yConfig.ubs.length - 1]).fill(null);

        for (let i = 0; i < yConfig.labels.length; i++) {
            let lb = i == 0 ? 0 : yConfig.ubs[i - 1];
            let ub = yConfig.ubs[i];
            const value = yConfig.labels[i];
            result.fill(value, lb, ub);
        }
        return result;
    }


    static *generateNoise(signal, mean=null, length=8192){
        const filtered = this.filter(signal, 20, 1395, 101, mean);

        let sum = 0;
        let i = 0;

        // first window of 8192 samples
        for (; i < length && i < filtered.length; i++) {
            sum += Math.abs(filtered[i]);
        }
        for (let j = 0; j < length && j < filtered.length; j++) {
            yield sum;
        }
        for (; i < filtered.length; i++) {
            sum += Math.abs(filtered[i]) - Math.abs(filtered[i - length]);
            yield sum;
        }
    }


    static zeroMean(signal, mean=null){
        mean = mean || d3.mean(signal);
        const output = new Array(signal.length);
        for(let i = 0; i < signal.length; i++) {
            output[i] = signal[i] - mean;
        }
        return output;
    }

    static *generateIntegral(signal, mean=null){
        mean = mean || d3.mean(signal);
        let sum = 0;
        for (let i = 0; i < signal.length; i++) {
            sum += signal[i] - mean;
            yield sum;
        }
    }

    static createHamming(length) {
        const window = new Array(length);
        for (let n = 0; n < length; n++) {
            window[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (length - 1));
        }
        return window;
    }

    static createSinc(length, cutoffFrequency, sampleRate) {
        const sinc = new Array(length);
        const center = (length - 1) / 2;
        const nyquist = sampleRate / 2;
        const normalizedCutoff = cutoffFrequency / nyquist;

        for (let n = 0; n < length; n++) {
            if (n === center) {
            sinc[n] = 2 * Math.PI * normalizedCutoff; // central value for sinc function
            } else {
            sinc[n] = Math.sin(2 * Math.PI * normalizedCutoff * (n - center)) / (Math.PI * (n - center));
            }
        }

        return sinc;
    }

    static createFilter(length, cutoffFrequency, sampleRate) {
        const sinc = this.createSinc(length, cutoffFrequency, sampleRate);
        const window = this.createHamming(length);

        // Apply windowing to sinc function
        return sinc.map((value, index) => value * window[index]);
    }

    static filterSignal(signal, filterCoefficients) {
        // Apply the filter forward (using convolution)
        const forwardFiltered = this.applyFilter(signal, filterCoefficients);
        // Apply the filter backward
        return this.applyFilter(forwardFiltered.reverse(), filterCoefficients).reverse();
    }

    static applyFilter(signal, filterCoefficients) {
        const output = new Array(signal.length);
        const filterLength = filterCoefficients.length;

        for (let i = 0; i < signal.length; i++) {
            let sum = 0;
            for (let j = 0; j < filterLength; j++) {
                if (i - j >= 0) {
                  sum += signal[i - j] * filterCoefficients[j];
                }
            }
            output[i] = sum;
        }
        return output;
    }

    static filter(signal, cutoffFrequency, sampleRate, nTaps, mean=null) {
        signal = this.zeroMean(signal, mean);
        const filterCoefficients = this.createFilter(nTaps, cutoffFrequency, sampleRate);
        return this.filterSignal(signal, filterCoefficients);
    }
}

export { DataContainer, buildPreload};