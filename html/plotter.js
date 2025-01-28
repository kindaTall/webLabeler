import {DataContainer} from "./dataContainer.js";
import { PlotConfig } from './plotConfig.js'


export class Plotter {
    constructor(data, containerId, config = PlotConfig.getDefaultConfig()) {
        this.data = data;
        this.containerId = containerId;
        this.config = config;
        this.labelingIndex = 0;

        this.margin = { top: 20, right: 20, bottom: 30, left: 40 };
        this.width = 1200 - this.margin.left - this.margin.right;
        this.height = 200 - this.margin.top - this.margin.bottom;
        this.container = d3.select(`#${containerId}`).append('div');
        this.plots = [];
        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.height]])
            .on("end", (event) => this.brushed(event));
        this.baseViewDomain = [0, this.data.dataLong.time.at(-1)];
        this.viewDomain = this.baseViewDomain;
        this.verticalLines = [];

        this.setupUI();
        this.createPlots();
        this.updateLines();

        this.setupClickHandlers();

    }

    destroy() {
        this.container.remove();
    }

    setupUI(){
        this.container.append("button")
            .attr("class", "btn btn-outline-primary me-2")
            .text("Zoom Out")
            .on("click", () => this.resetZoom());

        // add one radio button for each label, on click, change the labelingIndex
        for (let i = 0; i < this.data.yConfigs.length; i++) {
            const radioWrapper = this.container.append("div")
                .attr("class", "form-check form-check-inline");

            radioWrapper.append("input")
                .attr("class", "form-check-input")
                .attr("type", "radio")
                .attr("name", "label")
                .attr("value", i)
                .attr("checked", i == 0 ? true : null)
                .on("click", () => this.labelingIndex = i);

            radioWrapper.append("label")
                .attr("class", "form-check-label")
                .text(`label ${i}`);
        }
        this.container.append("br");
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

                    let indices = this.verticalLines.map(x=>Math.round(x*1395));
                    this.data.updateLabels(this.labelingIndex, indices[0], indices[1], label);
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
        for (const [name, plotConfig] of Object.entries(this.config.plots)) {
            this.plots.push(this.createPlot(name, plotConfig));
        }
    }

    createPlot(name, plotConfig) {
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

        const plotData = plotConfig.scalingConfig.autoScale ?
                    { xDomain: this.baseViewDomain, yDomain: [0, 1]} :
                    this.getPlotData(plotConfig);
                    
        const scales = this.createScales(plotData);

        this.createAxes(g, scales);
        const lines = this.createLines(g, plotData, scales, plotConfig);

        g.append("g")
            .attr("class", "brush")
            .call(this.brush);

        return { svg, g, scales, lines, plotConfig };
    }

    getPlotData(plotConfig) {
        let xMin = Infinity;
        let xMax = -Infinity;
        let yMin = Infinity;
        let yMax = -Infinity;

        Object.entries(plotConfig.series).forEach(([seriesName, seriesConfig]) => {
            const container = this.data.getContainer(seriesConfig.yKey);
            if (!container) return;

            const xMinCand = container.time[0];
            const xMaxCand = container.time.at(-1);
            const metaData = this.data.getMetaData(seriesConfig.yKey);
            const yMinCand = metaData.min;
            const yMaxCand = metaData.max;

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

    createLines(g, plotData, scales, plotConfig) {
        const colors = d3.schemeCategory10;
        return Object.entries(plotConfig.series).map(([seriesName, seriesConfig], i) => {
            const [xKey, yKey] = [seriesConfig.xKey, seriesConfig.yKey];
            const style = seriesConfig.style;
            const defaultStyle = this.config.defaultStyle;

            const lineGen = d3.line()
                .x((_, i, data) => scales.x(data.time[i]))
                .y((_, i, data) => scales.y(data[yKey][i]))
                .defined((_, i, data) => data[yKey][i] !== -1 && data[yKey][i] !== undefined);

            const path = g.append("path")
                .attr("class", "line")
                .attr("stroke", style.color || defaultStyle.color || colors[i])
                .attr("fill", "none")
                .attr("stroke-width", style.strokeWidth || defaultStyle.strokeWidth || 1.5)
                .attr("opacity", style.opacity || defaultStyle.opacity || 1);

            return { path, lineGen, xKey, yKey };
        });
    }

    updateLines() {
        const [x0, x1] = this.viewDomain;
        this.plots.forEach(plot => {
            plot.scales.x.domain([x0, x1]);
            this.gatherLTTBData(plot, x0, x1);
            this.updateYScale(plot);
            this.updatePaths(plot);
            this.updateAxes(plot);
        });
        this.updateVerticalLines();
    }
    
    gatherLTTBData(plot, x0, x1) {
        plot.lines.forEach(line => {
            const container = this.data.getContainer(line.yKey);
            const [start, stop] = this.calculateIndexRange(container, x0, x1);
            line.lttbData = largestTriangleThreeBucketsRF(
                {[line.yKey]: container[line.yKey].slice(start, stop), time: container.time.slice(start, stop)},
                this.width,
                'time',
                line.yKey
            );
        });
    }
    
    calculateIndexRange(container, x0, x1) {
        const c = container.time[0];
        const m = container.time[1] - container.time[0];
        return [x0, x1].map(a => 
            Math.max(0, Math.min(container.time.length, Math.round((a - c) / m)))
        );
    }
    
    updateYScale(plot) {
        if (!plot.plotConfig.scalingConfig.autoScale) return;

        const domains = plot.lines.map(line =>
            this.calculateYScaleSingle(line.lttbData, line.yKey, plot.plotConfig.scalingConfig)
        );
        const [min, max] = [
            Math.min(...domains.map(d => d[0])),
            Math.max(...domains.map(d => d[1]))
        ];

        plot.scales.y.domain([min, max]);
    }

    calculateYScaleSingle(array, key, scalingConfig){
        const [q05, q95] = [d3.quantile(array[key], scalingConfig.quantileRange.lower),
                            d3.quantile(array[key], scalingConfig.quantileRange.upper)];
        const [min, max] = [d3.min(array[key]), d3.max(array[key])];
        return this.calculateExpandedRange(q05, q95, min, max, scalingConfig);
    }
    
    calculateExpandedRange(min, max, q05, q95, scalingConfig) {
        const range = q95 - q05;
        const expandedMin = q05 - range * scalingConfig.expansionFactor;
        const expandedMax = q95 + range * scalingConfig.expansionFactor;
        return [
            Math.max(min, expandedMin),
            Math.min(max, expandedMax)
        ];
    }
    
    updatePaths(plot) {
        plot.lines.forEach(line => {
            const [x, y] = [line.lttbData.time, line.lttbData[line.yKey]];
            const lineGen = d3.line()
                .x((_, i) => plot.scales.x(x[i]))
                .y((_, i) => plot.scales.y(y[i]))
                .defined((_, i) => y[i] !== -1 && y[i] !== undefined);

            line.path
                .datum(line.lttbData.time)
                .attr("d", lineGen);
        });
    }
    
    updateAxes(plot) {
        plot.g.select(".y-axis").call(d3.axisLeft(plot.scales.y));
        plot.g.select(".x-axis").call(d3.axisBottom(plot.scales.x));
    }

    brushed(event) {
        if (!event.selection) return;
        if (event.selection[1] - event.selection[0] < 4){
            this.container.selectAll(".brush").call(this.brush.move, null);
            return;
        }

        const brushedGroup = event.sourceEvent.target.closest(".brush")?.parentNode;
        if (!brushedGroup) return;
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
