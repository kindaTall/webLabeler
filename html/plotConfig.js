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
            "scaling": {
                "autoScale": false,
                "quantileRange": { "lower": 0.025, "upper": 0.975 },
                "expansionFactor": 0.25,
                "fixedYRange": null
            }
        },
        "Signal": {
            "series": {
                "signal": {
                    xKey: "t",
                    yKey: "signal"
                }
            },
            "scaling": {
                "autoScale": true,
                "quantileRange": { "lower": 0.025, "upper": 0.975 },
                "expansionFactor": 0.25,
                "fixedYRange": null
            }
        },
        "Integral": {
            "series": {
                "integral": {
                    xKey: "t",
                    yKey: "integral"
                }
            },
            "scaling": {
                "autoScale": true,
                "quantileRange": { "lower": 0.025, "upper": 0.975 },
                "expansionFactor": 0.5,
                "fixedYRange": null
            }
        },
        "Noise": {
            "series": {
                "noise": {
                    xKey: "t",
                    yKey: "noise"
                }
            },
            "scaling": {
                "autoScale": true,
                "quantileRange": { "lower": 0.0, "upper": 0.7 },
                "expansionFactor": 3,
                "fixedYRange": null
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

class ScalingConfig {
    constructor(config = {}) {
        this.autoScale = config.autoScale ?? false;
        this.quantileRange = {
            lower: config.quantileRange?.lower ?? 0.025,
            upper: config.quantileRange?.upper ?? 0.975
        };
        this.expansionFactor = config.expansionFactor ?? 0.25;
        this.fixedYRange = config.fixedYRange ?? null;
    }
}

class PlotConfig {
    constructor({
        series = {},
        defaultStyle = {},
        scaling = {}
    } = {}) {
        this.series = {};
        this.defaultStyle = new SeriesStyle(defaultStyle);
        this.scalingConfig = new ScalingConfig(scaling);

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

        for (const [plotName, config] of Object.entries(plots)) {
            this.addPlot(plotName, config);
        }
    }

    static getDefault() {
        return new PlotterConfig(DEFAULT_CONFIG);
    }

    addPlot(plotName, config) {
        this.plots[plotName] = new PlotConfig({
            series: config.series,
            defaultStyle: this.defaultStyle,
            scaling: config.scaling
        });
    }

    getPlotConfig(plotName) {
        return this.plots[plotName];
    }
}

export { PlotterConfig, PlotConfig, SeriesConfig, SeriesStyle, ScalingConfig };