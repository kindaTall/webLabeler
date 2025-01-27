
const DEFAULT_CONFIG = {
    plots: {
        "Label": {
            "series": {
                "labels[0]": {
                    xKey: "t",
                    yKey: "labels.0",
                    style: { strokeWidth: 4, color: "red" }
                },
                "probabilities[0]": {
                    xKey: "t_probabilities",
                    yKey: "probabilities.0",
                    style: { strokeWidth: 1.5, color: "red" }
                },
                "labels[1]": {
                    xKey: "t",
                    yKey: "labels.1",
                    style: { strokeWidth: 4, color: "blue" }
                },
                "probabilities[1]": {
                    xKey: "t_probabilities",
                    yKey: "probabilities.1",
                    style: { strokeWidth: 1.5, color: "blue" }
                }
            },
            "autoScale": false
        },
        "Signal": {
            "series": {
                "signal": {
                    xKey: "t",
                    yKey: "signal"
                }
            },
            "autoScale": true
        },
        "Integral": {
            "series": {
                "integral": {
                    xKey: "t",
                    yKey: "integral"
                }
            },
            "autoScale": true
        },
        "Noise": {
            "series": {
                "noise": {
                    xKey: "t",
                    yKey: "noise"
                }
            },
            "autoScale": true
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
        this.autoScale = series?.autoScale || false;
        this.isManualScaled = false;

        for (const [seriesName, config] of Object.entries(series.series)) {
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