import {DataContainer} from "./dataContainer.js";
import {Plotter} from "./plotter.js";
import {Controller} from "./Controller.js";

function loadData() {
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
    let yConfigs = [
        {'ub': [10*60*1395, 40*60*1395, N], 'label': [0, 1, 0]},
        {'ub': [15*60*1395, 340*60*1395, N], 'label': [0.5, 1, 0]}
    ];
    const probLength = (N - 8192) / 512 + 1;
    let probabilities = Array.from({ length: probLength}, (_, i) => Math.min(1, Math.sin(i / 5000) + Math.random() * 0.2));
    probabilities = [probabilities, probabilities.map((x)=>1-x)];


    const data = new DataContainer(signal, yConfigs, probabilities);

    return data;
}


document.addEventListener("DOMContentLoaded", () => {
    const controller = new Controller();
//    const data = loadData();
//
//    // Config: name => [xKey, yKey] pairs
//    const config = {
//        "Label": [
//            ["t", "labels.0"],
//            ["t_probabilities", "probabilities.0"],
////            ["t", "labels.1"],
////            ["t_probabilities", "probabilities.1"]
//        ],
//        "Signal": [["t", "signal"]],
//        "Integral": [["t", "integral"]],
//        "Noise": [["t", "noise"]],
//    };
//
//    // Create the plotter with data, container ID, and config
//    const plotter = new Plotter(data, "plot", config);
});
