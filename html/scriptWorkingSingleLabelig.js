class Plotter {
    constructor(data, containerId, config = {}) {
        this.data = data;
        this.containerId = containerId;
        this.config = config;
        this.margin = { top: 20, right: 20, bottom: 30, left: 40 };
        this.width = 800 - this.margin.left - this.margin.right;
        this.height = 200 - this.margin.top - this.margin.bottom;
        this.container = d3.select(`#${containerId}`);
        this.plots = [];
        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.height]])
            .on("end", (event) => this.brushed(event));
        this.baseViewDomain = [0, this.data.t.at(-1)];
        this.viewDomain = this.baseViewDomain;
        this.verticalLines = [];

        this.createPlots();
        this.updateLines();

        this.setupClickHandlers();
    }

    setupClickHandlers() {
        this.plots.forEach(plot => {
            plot.svg.on("click", (event) => {
                const plotElement = event.target.closest("svg");
                const plotIndex = this.plots.findIndex(p => p.svg.node() === plotElement);
                const plotIndex_ = this.plots.findIndex(p=>p==plot);

                if (plotIndex < 0){ return;}
                if (this.verticalLines.length === 2 && plotIndex !== 0) {return;}

                const [x, y] = d3.pointer(event);

                if (this.verticalLines.length < 2){
                    const xValue = plot.scales.x.invert(x - this.margin.left);
                    this.verticalLines.push(xValue);
                    this.updateVerticalLines();
                }

                if (this.verticalLines.length === 2 && plotIndex === 0){
                    const yValue = plot.scales.y.invert(y-this.margin.top);
                    const label = Math.round(yValue*2)/2;
                    const delta = Math.abs(yValue - label);
                    if (delta > 0.1){
                        console.log("Can't label with value too far from label points");
                        this.updateVerticalLines();
                        return;
                    }
                    console.log("labeling from", this.verticalLines[0], "to", this.verticalLines[1], "with", label);

                    let indices = this.verticalLines.map(x=>Math.max(0, Math.min(this.data.label.length-1, Math.round(x*1395))));
                    for (let i = indices[0]; i < indices[1]; i++) {
                        this.data.label[i] = label;
                    }
                    this.verticalLines = [];
                    this.updateLines();
                }
            });
        });
    }

    drawLine(x) {
        this.verticalLines.push(x);
        this.updateVerticalLines();
    }

    updateVerticalLines() {
        this.plots.forEach(plot => {
            // Remove existing vertical lines
            plot.g.selectAll(".vertical-line").remove();

            // Draw new lines
            this.verticalLines.forEach(x => {
                if (x >= this.viewDomain[0] && x <= this.viewDomain[1]) {
                    plot.g.append("line")
                        .attr("class", "vertical-line")
                        .attr("x1", plot.scales.x(x))
                        .attr("x2", plot.scales.x(x))
                        .attr("y1", 0)
                        .attr("y2", this.height)
                        .attr("stroke", "red")
                        .attr("stroke-width", 1);
                }
            });
        });
    }

    createPlots() {
        for (const [name, series] of Object.entries(this.config)) {
            this.plots.push(this.createPlot(name, series));
        }
    }

    createPlot(name, series) {
        const svg = this.container.append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("margin-top", "10px");

        const g = svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Add title
        svg.append("text")
            .attr("x", this.width / 2 + this.margin.left)
            .attr("y", this.margin.top / 2)
            .attr("text-anchor", "middle")
            .text(name);

        const plotData = this.getPlotData(series);
        const scales = this.createScales(plotData);

        this.createAxes(g, scales);
        const lines = this.createLines(g, plotData, scales, series);

        g.append("g")
            .attr("class", "brush")
            .call(this.brush);

        return { svg, g, scales, lines, series };
    }

    getPlotData(series) {
        let xMin = Infinity;
        let xMax = -Infinity;
        let yMin = Infinity;
        let yMax = -Infinity;

        series.forEach(([xKey, yKey]) => {
            const x = this.data[xKey];
            const y = this.data[yKey];
            if (!x || !y) return;

            const xMinCand = x.min();
            const xMaxCand = x.max();
            const yMinCand = y.min();
            const yMaxCand = y.max();

            xMin = xMin > xMinCand ? xMinCand : xMin;
            xMax = xMax < xMaxCand ? xMaxCand : xMax;
            yMin = yMin > yMinCand ? yMinCand : yMin;
            yMax = yMax < yMaxCand ? yMaxCand : yMax;
        });

        return {
            xDomain: [xMin, xMax],
            yDomain: [yMin, yMax]
        };
    }

    createScales(plotData) {
        return {
            x: d3.scaleLinear()
                .domain(plotData.xDomain)
                .range([0, this.width]),
            y: d3.scaleLinear()
                .domain(plotData.yDomain)
                .range([this.height, 0])
        };
    }

    createAxes(g, scales) {
        g.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${this.height})`)
            .call(d3.axisBottom(scales.x));

        g.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(scales.y));
    }

    createLines(g, plotData, scales, series) {
        const colors = d3.schemeCategory10;
        return series.map(([xKey, yKey], i) => {
            const lineGen = d3.line()
                .x(j => scales.x(this.data[xKey][j]))
                .y(j => scales.y(this.data[yKey][j]));

            const path = g.append("path")
                .attr("class", "line")
                .attr("stroke", colors[i])
                .attr("fill", "none");

            return { path, lineGen, xKey, yKey };
        });
    }

    updateLines() {
        const [x0, x1] = this.viewDomain;

        this.plots.forEach(plot => {
            plot.scales.x.domain([x0, x1]);

            plot.lines.forEach(line => {
                const x = this.data[line.xKey];
                const c = x[0];
                const m = x[1] - x[0]
                const [start, stop] = [x0, x1].map(a=>Math.max(0, Math.min(x.length-1, Math.round((a - c) / m))));
                let filteredIndices = this.linspace(start, stop, this.width, true, Math.round);

                line.path
                    .datum(filteredIndices)
                    .attr("d", line.lineGen);
            });

            plot.g.select(".x-axis").call(d3.axisBottom(plot.scales.x));
        });
        this.updateVerticalLines();
    }

    linspace(start, end, n, endpoint=true, cast=(x)=>x) {
        const div = endpoint ? n - 1 : n;
        const step = (end - start) / div;
        return Array.from({ length: n }, (_, i) => cast(start + step * i));
    }

    brushed(event) {
        if (!event.selection) return;

        const brushedGroup = event.sourceEvent.target.closest(".brush").parentNode;
        const brushedPlot = this.plots.find(plot => plot.g.node() === brushedGroup);
        if (!brushedPlot) return;

        const selectionDomain = event.selection.map(brushedPlot.scales.x.invert);
        this.viewDomain = selectionDomain;
        this.updateLines();

        this.container.selectAll(".brush").call(this.brush.move, null);
    }

    resetZoom() {
        this.viewDomain = this.baseViewDomain;
        this.updateLines();
    }
}

class DataContainer {
    constructor(signal, yConfig, probabilities) {
        if (signal.length !== yConfig.ub.at(-1)){
            throw new Error("Length of signal and yConfig.ub must be equal");
        }
        this.signal = signal;
        this.t = DataContainer.linearTime(signal.length, 0, 1 / 1395);
        this.t_probabilities = DataContainer.linearTime(probabilities.length, 8192/1395, 512 / 1395);
        this.label = DataContainer.yConfigToArray(yConfig);
        this.integral = DataContainer.calculateIntegral(signal);
        this.noise = DataContainer.calculateNoise(signal);
        this.probabilities = probabilities;

        // add ._min and min(), ._max and max(), to arrays
        [this.signal, this.t, this.t_probabilities, this.label, this.integral, this.noise, this.probabilities].forEach(arr => {
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
        [this.label, this.probabilities].forEach(arr => {
            arr._min = 0;
            arr._max = 1;
        })
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

    static yConfigToArray(yConfig){
        let result = new Array(yConfig.ub[yConfig.ub.length - 1]).fill(null);

        for (let i = 0; i < yConfig.label.length; i++) {
            let lb = i == 0 ? 0 : yConfig.ub[i - 1];
            let ub = yConfig.ub[i];
            result.fill(yConfig.label[i], lb, ub);
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
        // subtract mean and create cumsum (integral=cumsum(signal-mean(signal))
        let integral = this.zeroMean(signal);
        integral[0] = signal[0];
        for (let i = 1; i < integral.length; i++) {
            integral[i] = integral[i-1] + signal[i];
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


document.addEventListener("DOMContentLoaded", () => {
    function buildSignal(n){
        let i = 0;
        let output = new Array(n);
        let step = i / 5000;
        for (let j = 0; j < n; j++) {
            output[j] = Math.sin(i) + Math.random() * 0.2;
            i += step;
        }
        return output;
    }


    const N = 5000000; // Large dataset
    // create an array "signal" with this formula: Math.sin(i / 5000) + Math.random() * 0.2
    let signal = buildSignal(N);
    let yConfig = {'ub': [10*60*1395, 40*60*1395, N], 'label': [0, 1, 0]};
    const probLength = (N - 8192) / 512 + 1;
    let probabilities = Array.from({ length: probLength}, (_, i) => Math.sin(i / 5000) + Math.random() * 0.2);


    const data = new DataContainer(signal, yConfig, probabilities);

    // Config: name => [xKey, yKey] pairs
    const config = {
        "Label": [["t", "label"], ["t_probabilities", "probabilities"]],
        "Signal": [["t", "signal"]],
        "Integral": [["t", "integral"]],
        "Noise": [["t", "noise"]],
    };

    // Create the plotter with data, container ID, and config
    const plotter = new Plotter(data, "plot", config);

    // Example of a zoom-out button to reset zoom
    d3.select("body").append("button")
        .text("Zoom Out")
        .on("click", () => plotter.resetZoom());
});
