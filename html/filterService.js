// filterService.js
class FilterService {
    static instance = null;

    constructor() {
        if (FilterService.instance) {
            return FilterService.instance;
        }

        this.filters = new Map();
        this.initDefaultFilters();
        FilterService.instance = this;
    }

    initDefaultFilters() {
        // Add our default noise filter
        this.addFilter('noise', {
            type: 'lowpass',
            order: 3,
            characteristic: 'butterworth',
            Fs: 1395,
            Fc: 20,
            BW: 1,
            gain: 0,
            preGain: false
        });

        this.addFilter('audio', {
            type: 'lowpass',
            order: 8,
            characteristic: 'butterworth',
            Fs: 1395,
            Fc: 30,
            BW: 1,
            gain: 0,
            preGain: false
        });
    }

    addFilter(name, config) {
        const iirCalculator = new Fili.CalcCascades();

        // Validate filter type
        if (!['lowpass', 'highpass', 'bandpass', 'bandstop', 'peak'].includes(config.type)) {
            throw new Error(`Invalid filter type: ${config.type}`);
        }

        // Build filter coefficients based on type
        const filterCoeffs = iirCalculator[config.type]({
            order: config.order,
            characteristic: config.characteristic,
            Fs: config.Fs,
            Fc: config.Fc,
            BW: config.BW,
            gain: config.gain,
            preGain: config.preGain
        });

        // Create and store the filter
        this.filters.set(name, new Fili.IirFilter(filterCoeffs));
    }

    filterSignal(signal, filterName) {
        const filter = this.filters.get(filterName);
        if (!filter) {
            throw new Error(`Filter not found: ${filterName}`);
        }
        return filter.filtfilt(signal);
    }

    // Helper to get available filter names
    getAvailableFilters() {
        return Array.from(this.filters.keys());
    }

    // Helper to check if a filter exists
    hasFilter(name) {
        return this.filters.has(name);
    }

    // Method to remove a filter if needed
    removeFilter(name) {
        if (name === 'noise') {
            throw new Error('Cannot remove default noise filter');
        }
        return this.filters.delete(name);
    }
}

// Create and export singleton instance
export const filterService = new FilterService();