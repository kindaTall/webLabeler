import {DataContainer} from "./dataContainer.js";
import { PlotConfig } from './plotConfig.js'


export class Plotter {
    constructor(data, containerId, config = PlotConfig.getDefaultConfig()) {
        this.data = data;
        this.containerId = containerId;
        this.config = config;
        this.labelingIndex = 0;

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

        this.setupUI();
    }

    destroy() {
        this.container.selectAll("svg").remove();
        this.container.selectAll("button").remove();
    }

    setupUI(){
        this.container.append("button")
            .text("Zoom Out")
            .on("click", () => this.resetZoom());
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

                    let indices = this.verticalLines.map(x=>Math.max(0, Math.min(this.data.labels[this.labelingIndex].length-1, Math.round(x*1395))));
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

        const plotData = this.getPlotData(plotConfig);
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
            const x = this.data.get(seriesConfig.xKey);
            const y = this.data.get(seriesConfig.yKey);
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

    createLines(g, plotData, scales, plotConfig) {
        const colors = d3.schemeCategory10;
        return Object.entries(plotConfig.series).map(([seriesName, seriesConfig], i) => {
            const [xKey, yKey] = [seriesConfig.xKey, seriesConfig.yKey];
            const style = seriesConfig.style;
            const defaultStyle = this.config.defaultStyle;

            const lineGen = d3.line()
                .x(j => scales.x(this.data.get(xKey)[j]))
                .y(j => scales.y(this.data.get(yKey)[j]))
                .defined(j => {
                    const value = this.data.get(yKey)[j];
                    return value !== -1 && value !== undefined;
                });

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

            plot.lines.forEach(line => {
                const x = this.data.get(line.xKey);
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
