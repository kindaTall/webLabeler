import { api } from './api.js';

export class DataContainer {
    constructor(filename, signal, yConfigs, probabilities) {
        if (signal.length !== yConfigs[0].ubs.at(-1)){
            throw new Error("Length of signal and yConfig.ubs must be equal");
        }
        this.filename = filename;
        this.signal = signal;
        this.yConfigs = yConfigs;
        this.probabilities = probabilities;

        // calculate time arrays
        this.t = DataContainer.linearTime(signal.length, 0, 1 / 1395);
        this.t_probabilities = DataContainer.linearTime(probabilities[0].length, 8192/1395, 512 / 1395);

        // create labels array
        this.labels = yConfigs.map(DataContainer.yConfigToArray);

        // calculate integral and noise
        this.integral = DataContainer.calculateIntegral(signal);
        this.noise = DataContainer.calculateNoise(signal);

        // Add metadata to arrays
        this.addDataMeta();
    }

    updateLabels(index, start, end, label){
        label = label == 0.5 ? -1 : label;
        let changes = false;
        for (let i = start; i < end; i++) {
            if (this.labels[index][i] !== label){
                changes = true;
                this.labels[index][i] = label;
            }
        }
        if (!changes){
            return;
        }
        this.updateAndSendLabels(index);
    }

    async updateAndSendLabels(index) {
        this.yConfigs[index] = DataContainer.ArrayToYConfig(this.labels[index]);
        api.updateLabels(this.filename, this.yConfigs);
    }


    addDataMeta(data){
         // add ._min and min(), ._max and max(), to arrays
        [this.signal, this.t, this.t_probabilities, this.integral, this.noise].forEach(arr => {
            arr._min = null;
            arr._max = null;
            arr.min = function(){
                if (this._min === null){
                    this._min = d3.min(this);
                }
                return this._min;
            };
            arr.max = function(){
                if (this._max === null){
                    this._max = d3.max(this);
                }
                return this._max;
            };
        });
        [this.t, this.t_probabilities].forEach(arr => {
            arr._min = arr.at(0);
            arr._max = arr.at(-1);
        });
        [this.labels, this.probabilities].forEach(arrList => {
            arrList.forEach(arr => {
                arr.min = () => 0;
                arr.max = () => 1;
            });
        });
    }


    get(key) {
        if (key.includes('.')){
            let [arrKey, prop] = key.split('.');
            return this[arrKey][prop];
        }
        return this[key];
    }

    static linearTime(n, start, step){
        const output = new Array(n);
        let value = start;
        for (let i = 0; i < n; i++) {
            output[i] = value;
            value += step;
        }
        return output;
    }

    static ArrayToYConfig(array) {
        let ubs = [];
        let labels = [];
        let prev = array[0];

        for (let i = 1; i < array.length; i++) {
            if (array[i] !== prev){
                ubs.push(i);
                labels.push(prev);
                prev = array[i];
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
            const value = yConfig.labels[i] === 0.5 ? null : yConfig.labels[i];
            result.fill(value, lb, ub);
        }
        return result;
    }

    static calculateNoise(signal, length=8192){
        const filtered = this.filter(signal, 20, 1395, 101);
        const output = new Array(signal.length).fill(0);

        let sum = 0;

        // First, handle the first `subLength` samples
        for (let i = 0; i < length && i < signal.length; i++) {
            sum += filtered[i];
            output[i] = sum / (i + 1); // Average of the first `i+1` samples
        }

        // Then, for the rest of the signal, use sliding window
        for (let i = length; i < signal.length; i++) {
            sum += filtered[i];              // Add the next sample in the window
            sum -= filtered[i - length];     // Remove the sample that's sliding out of the window
            output[i] = sum / length;        // Average of the last `length` samples
        }

        return output;
    }

    static zeroMean(signal){
        let mean = d3.mean(signal);
        const output = new Array(signal.length);
        for(let i = 0; i < signal.length; i++) {
            output[i] = signal[i] - mean;
        }
        return output;
    }

    static calculateIntegral(signal){
        let integral = this.zeroMean(signal);
        for (let i = 1; i < integral.length; i++) {
            integral[i] += integral[i-1];
        }
        return integral;
    }


    // Method to create Hamming window
    static createHamming(length) {
        const window = new Array(length);
        for (let n = 0; n < length; n++) {
            window[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (length - 1));
        }
        return window;
    }

    // Method to create sinc function (ideal low-pass filter)
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

    // Method to create filter coefficients (Hamming window + sinc function)
    static createFilter(length, cutoffFrequency, sampleRate) {
        const sinc = this.createSinc(length, cutoffFrequency, sampleRate);
        const window = this.createHamming(length);

        // Apply windowing to sinc function
        return sinc.map((value, index) => value * window[index]);
    }

    // Method to filter a signal (backwards and forwards with passed filter coefficients)
    static filterSignal(signal, filterCoefficients) {
        // Apply the filter forward (using convolution)
        const forwardFiltered = this.applyFilter(signal, filterCoefficients);
        // Apply the filter backward
        return this.applyFilter(forwardFiltered.reverse(), filterCoefficients).reverse();
    }

    static applyFilter(signal, filterCoefficients) {
        const output = new Array(signal.length);
        const filterLength = filterCoefficients.length;

        signal = this.zeroMean(signal);
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

    static filter(signal, cutoffFrequency, sampleRate, nTaps) {
        const filterCoefficients = this.createFilter(nTaps, cutoffFrequency, sampleRate);
        return this.filterSignal(signal, filterCoefficients);
    }
}
