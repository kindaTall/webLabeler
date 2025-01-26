
const DEFAULT_CONFIG = {
    plots: {
        "Label": {
            "labels": {
                xKey: "t",
                yKey: "labels.0",
                style: { strokeWidth: 4, color: "red" }
            },
            "probabilities": {
                xKey: "t_probabilities",
                yKey: "probabilities.0",
                style: { strokeWidth: 1.5, color: "red" }
            }
        },
        "Signal": {
            "signal": {
                xKey: "t",
                yKey: "signal"
            }
        },
        "Integral": {
            "integral": {
                xKey: "t",
                yKey: "integral"
            }
        },
        "Noise": {
            "noise": {
                xKey: "t",
                yKey: "noise"
            }
        }
    }
};

class SeriesStyle {
    constructor({
        color = null,
        strokeWidth = 1.5,
        opacity = 1
    } = {}) {
        this.color = color;
        this.strokeWidth = strokeWidth;
        this.opacity = opacity;
    }
}

class SeriesConfig {
    constructor({
        xKey,
        yKey,
        style = {}
    }) {
        if (!xKey || !yKey) throw new Error("xKey and yKey required");
        this.xKey = xKey;
        this.yKey = yKey;
        this.style = new SeriesStyle(style);
    }
}

class PlotConfig {
    constructor({
        series = {},
        defaultStyle = {}
    } = {}) {
        this.series = {};
        this.defaultStyle = new SeriesStyle(defaultStyle);

        for (const [seriesName, config] of Object.entries(series)) {
            this.addSeries(seriesName, config);
        }
    }

    addSeries(seriesName, config) {
        this.series[seriesName] = new SeriesConfig(config);
    }

    getSeriesStyle(seriesName) {
        return this.series[seriesName]?.style || this.defaultStyle;
    }
}

class PlotterConfig {
    constructor({
        plots = {},
        defaultStyle = {}
    } = {}) {
        this.plots = {};
        this.defaultStyle = new SeriesStyle(defaultStyle);

        for (const [plotName, series] of Object.entries(plots)) {
            this.addPlot(plotName, series);
        }
    }

    static getDefault() {
        return new PlotterConfig(DEFAULT_CONFIG);
    }

    addPlot(plotName, series) {
        this.plots[plotName] = new PlotConfig({series, defaultStyle: this.defaultStyle});
    }

    getPlotConfig(plotName) {
        return this.plots[plotName];
    }
}

export { PlotterConfig, PlotConfig, SeriesConfig, SeriesStyle };