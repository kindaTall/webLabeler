import {DataContainer} from "./dataContainer.js";
import { PlotConfig } from './plotConfig.js'


export class Plotter {
    constructor(data, containerId, config = PlotConfig.getDefaultConfig()) {
        this.data = data;
        this.containerId = containerId;
        this.config = config;
        this.labelingIndex = 0;


        // Create container first to get proper dimensions
        this.container = d3.select(`#${containerId}`).append('div')
            .style("width", "100%")
            .style("height", "95vh")
            .style("overflow-y", "auto");

        // Calculate dimensions after container is created
        this.margin = { top: 20, right: 20, bottom: 30, left: 40 };
        this.calculateDimensions();

        this.plots = [];
        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.height]])
            .on("end", (event) => this.brushed(event));

        this.overviewBrush = d3.brushX()
            .extent([[0, 0], [this.width, this.overviewHeight]])
            .on("brush end", (event) => this.overviewBrushed(event));
        this.isUpdatingOverview = false;


        this.baseViewDomain = [0, this.data.dataLong.time.at(-1)];
        this.viewDomain = this.baseViewDomain;


        const uiHeader = this.setupUI();
        this.createPlots();
        this.updatePlot(this.overview);
        this.relabeler = new Relabeler({plots:this.plots, data:this.data, parent:this, uiHeader});

        this.updateLines();
    }

    destroy() {
        this.container.remove();
    }

    setupUI() {
        // Add controls in a fixed header
        const header = this.container.insert("div", ":first-child")
            .style("position", "sticky")
            .style("top", "0")
            .style("background-color", "white")
            .style("padding", "10px")
            .style("z-index", "1000");

        header.append("button")
            .attr("class", "btn btn-outline-primary me-2")
            .text("Zoom Out")
            .on("click", () => this.resetZoom());
        return header;
    }

    calculateDimensions() {
        // Get number of plots from config
        const numPlots = Object.keys(this.config.plots).length;
        const overviewHeightRatio = 0.25;

        // Calculate height based on viewport
        const totalHeight = window.innerHeight - 100; // 100px for UI elements
        this.height = (totalHeight / (numPlots + overviewHeightRatio) ) - this.margin.top - this.margin.bottom;
        this.overviewHeight = this.height * overviewHeightRatio;

        // Get actual container width in pixels
        const containerWidth = Math.floor(this.container.node().getBoundingClientRect().width);
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.plotShape = {width:this.width, height:this.height};
        this.overviewShape = {width:this.width, height:this.overviewHeight};
    }

    createPlots() {
        this.overview = this.createOverviewPlot();
        for (const [name, plotConfig] of Object.entries(this.config.plots)) {
            this.plots.push(this.createPlot(name, plotConfig));
        }
    }

    createPlotArgs({plotConfig, shape, name=null, axis=true, }){
        const svg = this.container.append("svg")
            .attr("width", shape.width + this.margin.left + this.margin.right)
            .attr("height", shape.height + this.margin.top + this.margin.bottom)
            .style("margin-top", "10px");

        const g = svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        if (name){
             svg.append("text")
                .attr("x", shape.width / 2 + this.margin.left)
                .attr("y", this.margin.top / 2)
                .attr("text-anchor", "middle")
                .text(name);
        }

        const plotData = this.getPlotData(plotConfig);
        const scales = this.createScales({xDomain: this.baseViewDomain, yDomain:plotData.yDomain}, shape);

        if (axis){
           // Create axes
            this.createAxes(g, scales, shape.height);
        }

        const lines = this.createLines(g, plotData, scales, plotConfig);

        return {svg, g, scales, lines};
    }

    createOverviewPlot() {
        const plotConfig = this.config.plots.Signal;
        const {svg, g, scales, lines} = this.createPlotArgs({plotConfig, shape:this.overviewShape, axis:false});


        // Add brush
        const brush = g.append("g")
            .attr("class", "overview-brush")
            .call(this.overviewBrush)
            .call(this.overviewBrush.move, [
                scales.x(this.viewDomain[0]),
                scales.x(this.viewDomain[1])
            ]);

        const adjustBrush = () => {
            brush.call(this.overviewBrush.move, [
                scales.x(this.viewDomain[0]),
                scales.x(this.viewDomain[1])
            ]);
        };

        return new OverviewPlot({ svg, g, scales, lines, plotConfig, adjustBrush, shape:this.overviewShape, margin:this.margin});
    }
    
    createPlot(name, plotConfig) {
        const {svg, g, scales, lines} = this.createPlotArgs({plotConfig, shape:this.plotShape, name});

        g.append("g")
            .attr("class", "brush")
            .call(this.brush);

        return new BasePlot({ svg, g, scales, lines, plotConfig, shape:this.plotShape, margin:this.margin });
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

    createScales({xDomain, yDomain}, {width, height}) {
        return {
            x: d3.scaleLinear()
                .domain(xDomain)
                .range([0, width]),
            y: d3.scaleLinear()
                .domain(yDomain)
                .range([height, 0])
        };
    }

    createAxes(g, scales, height) {
        g.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(scales.x));

        g.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(scales.y).ticks(3));
    }

    createLines(g, plotData, scales, plotConfig) {
        const colors = d3.schemeCategory10;
        return Object.entries(plotConfig.series).map(([seriesName, seriesConfig], i) => {
            const yKey = seriesConfig.yKey;
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

            return new Line({ path, lineGen, yKey });  // Todo: Create line class for better containing
        });
    }

    updateLines() {
        this.plots.forEach(plot => this.updatePlot(plot));
        this.relabeler.updateVerticalLines();
        this.overview.adjustBrush();
    }

    updatePlot(plot){
        this.gatherLTTBData(plot);
        this.updatePlotScaleDomain(plot);
        this.updatePaths(plot);
        this.updateAxes(plot);
    }
    
    gatherLTTBData(plot) {
        const [x0, x1] = this.viewDomain;
        plot.lines.forEach(line => {
            const container = this.data.getContainer(line.yKey);
            const [start, stop] = this.calculateIndexRange(container, x0, x1);
            if (line?.lttbData?.bounds.start == start && line?.lttbData?.bounds.stop == stop) return;
            line.lttbData = {
                bounds : {start, stop},
                data : largestTriangleThreeBucketsRF(
                    {[line.yKey]: container[line.yKey].slice(start, stop), time: container.time.slice(start, stop)},
                    this.width,
                    'time',
                    line.yKey
                )
            };
        });
    }
    
    calculateIndexRange(container, x0, x1) {
        const c = container.time[0];
        const m = container.time[1] - container.time[0];
        return [x0, x1].map(a => 
            Math.max(0, Math.min(container.time.length, Math.round((a - c) / m)))
        );
    }
    
    updatePlotScaleDomain(plot) {
        plot.scales.x.domain(this.viewDomain);

        if (!plot.plotConfig.scalingConfig.autoScale) return;

        const yDomains = plot.lines.map(line =>
            this.calculateYScaleSingle(line.lttbData.data, line.yKey, plot.plotConfig.scalingConfig)
        );
        const [min, max] = [
            Math.min(...yDomains.map(d => d[0])),
            Math.max(...yDomains.map(d => d[1]))
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
            const [x, y] = [line.lttbData.data.time, line.lttbData.data[line.yKey]];
            const lineGen = d3.line()
                .x((_, i) => plot.scales.x(x[i]))
                .y((_, i) => plot.scales.y(y[i]))
                .defined((_, i) => y[i] !== -1 && y[i] !== undefined);

            line.path
                .datum(x)
                .attr("d", lineGen);
        });
    }
    
    updateAxes(plot) {
        plot.g.select(".y-axis")?.call(d3.axisLeft(plot.scales.y));
        plot.g.select(".x-axis")?.call(d3.axisBottom(plot.scales.x));
    }

    overviewBrushed(event) {
        if (!event.selection) return;
        if (!this.overview) return;
        if (this.isUpdatingOverview) return;

        this.isUpdatingOverview = true;

        const [x0, x1] = event.selection.map(this.overview.scales.x.invert);

        this.viewDomain = [x0, x1];

        this.updateLines();

        this.isUpdatingOverview = false;
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


class Relabeler {
    // Constants
    static LABEL_VALUES = [
        [0, 'label: 0'],
        [0.5, 'label: unknown'],
        [1, 'label: 1']
    ];
    static DATA_POINTS = 1395; // Magic number from indices calculation

    constructor({plots, data, parent, uiHeader}) {
        if (!Array.isArray(plots) || !plots.length) {
            throw new Error('Plots array is required and must not be empty');
        }
        if (!data || !data.yConfigs) {
            throw new Error('Data with yConfigs is required');
        }

        this.verticalLines = [];
        this.labelingIndex = 0;
        this.plots = plots;
        this.data = data;
        this.parent = parent;

        this.labelLineOpacity = {
            disabled: 0.1,
            normal: 0.2,
            hover: 0.5
        };

        // Initialize components
        this.#setupLabelLines();
        this.#setupClickHandlers();
        this.#setupUI(uiHeader);
    }

    /**
     * Initializes the horizontal label lines with their interactions
     * @private
     */
    #setupLabelLines() {
        this.labelLines = Relabeler.LABEL_VALUES.map(([label, title]) => {
            const line = this.#addLine(
                    this.plots[0],
                    'label-line',
                    {x1: 0, y1: label},
                    {x2: this.parent.viewDomain[1], y2: label},
                    "gray",
                    this.#calculateLineWidth(),
                    this.labelLineOpacity.disabled
                )
                .style("cursor", "crosshair")
                .attr("title", title);

            line.hovered = false;

            this.#setupLineInteractions(line, label);
            return line;
        });
    }

    /**
     * Sets up hover and click interactions for a label line
     * @private
     */
    #setupLineInteractions(line, label) {
        line
            .on("mouseover", () => {
                line.hovered = true;
                this.#updateLineOpacity(line);
            })
            .on("mouseout", () => {
                line.hovered = false;
                this.#updateLineOpacity(line);
            })
            .on("click", (event) => {
                this.#handleLabelLineClick(event, label);
            });
    }

    /**
     * Calculates appropriate line width based on plot height
     * @private
     */
    #calculateLineWidth() {
        return Math.max(1, Math.min(10, this.plots[0].shape.height / 14));
    }

    /**
     * Updates opacity for a single line based on current state
     */
    #updateLineOpacity(line) {
        const opacity = this.verticalLines.length
            ? (line.hovered ? this.labelLineOpacity.hover : this.labelLineOpacity.normal)
            : this.labelLineOpacity.disabled;
        line.attr("opacity", opacity);
    }

    /**
     * Updates all vertical lines across all plots
     */
    updateVerticalLines() {
        this.plots.forEach(plot => {
            plot.g.selectAll(".vertical-line").remove();

            this.verticalLines
                .filter(x => x >= this.parent.viewDomain[0] && x <= this.parent.viewDomain[1])
                .forEach(x => {
                    this.#addLine(
                        plot,
                        "vertical-line",
                        {x1: x, y1: plot.scales.y.invert(0)},
                        {x2: x, y2: plot.scales.y.invert(plot.shape.height)},
                        "red",
                        1,
                        1
                    );
                });
        });
    }

    /**
     * Sets up click handlers for all plots
     */
    #setupClickHandlers() {
        this.plots.forEach(plot => {
            plot.svg.on("click", (event) => {
                this.#handlePlotClick(event, plot);
            });
        });
    }

    /**
     * Handles clicks on the plot area
     */
    #handlePlotClick(event, plot) {
        if (this.verticalLines.length < 2) {
            const xValue = plot.scales.x.invert(event.x - plot.margin.left);
            this.#addVerticalLine(xValue);
        }
    }

    /**
     * Handles clicks on label lines
     */
    #handleLabelLineClick(event, value) {
        event.stopPropagation();
        this.#handlePlotClick(event, this.plots[0]);

        if (this.verticalLines.length !== 2) return;

        const indices = this.verticalLines.map(x =>
            Math.round(x * Relabeler.DATA_POINTS)
        );

        this.#applyLabel(indices, value);
    }

    /**
     * Applies the label and updates the visualization
     * @private
     */
    #applyLabel(indices, value) {
        this.data.updateLabels(this.labelingIndex, indices[0], indices[1], value);
        this.#resetState();
    }

    /**
     * Resets the state after labeling
     * @private
     */
    #resetState() {
        this.verticalLines = [];
        this.labelLines.forEach(line => this.#updateLineOpacity(line));

        // Clear cached data and update visualization
        this.plots[0].lines.forEach(line => {
            line.lttbData = null;
        });

        this.updateVerticalLines();
        this.parent.updatePlot(this.plots[0]);
    }

    /**
     * Adds a vertical line and updates the visualization
     */
    #addVerticalLine(x) {
        this.verticalLines.push(x);
        this.updateVerticalLines();
        this.labelLines.forEach(line => this.#updateLineOpacity(line));
    }

    /**
     * Sets up the UI controls
     */
    #setupUI(header) {
        this.data.yConfigs.forEach((_, i) => {
            const radioWrapper = header.append("div")
                .attr("class", "form-check form-check-inline");

            radioWrapper.append("input")
                .attr("class", "form-check-input")
                .attr("type", "radio")
                .attr("name", "label")
                .attr("value", i)
                .attr("checked", i === 0 ? true : null)
                .on("click", () => this.labelingIndex = i);

            radioWrapper.append("label")
                .attr("class", "form-check-label")
                .text(`label ${i}`);
        });
    }

    /**
     * Helper method to add a line to a plot
     * @private
     */
    #addLine(plot, classList, {x1, y1}, {x2, y2}, stroke="red", strokeWidth=1, opacity=1) {
        return plot.g.append("line")
            .attr("class", classList)
            .attr("x1", plot.scales.x(x1))
            .attr("x2", plot.scales.x(x2))
            .attr("y1", plot.scales.y(y1))
            .attr("y2", plot.scales.y(y2))
            .attr("stroke", stroke)
            .attr("stroke-width", strokeWidth)
            .attr("opacity", opacity);
    }
}


class BasePlot{

    constructor ( { svg, g, scales, lines, plotConfig, shape, margin }){
        this.svg = svg;
        this.g = g;
        this.scales = scales;
        this.lines = lines;
        this.plotConfig = plotConfig;

        this.shape = shape;
        this.margin = margin;
    }
}

class OverviewPlot extends BasePlot {
    constructor ( { svg, g, scales, lines, plotConfig, adjustBrush}){
        super( { svg, g, scales, lines, plotConfig });
        this.adjustBrush = adjustBrush;
    }
}

class Line {
    constructor({ path, lineGen, yKey }){
        this.path = path;
        this.lineGen = lineGen;
        this.yKey = yKey;
    }
}
