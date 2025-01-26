import { DataContainer } from "./DataContainer.js";
import { api } from './api.js';

class FileSelector {
    constructor(fileChangedCallback) {
       this.fileList = [{id: "null", name: "Select a file"}]; // Default option
       this.UIElements = null;
       this.selectedFile = null;
       this.fileChangedCallback = fileChangedCallback;

       api.getFileList()
           .then(files => {
               this.fileList.push(...files.map(f => ({id: f, name: f})));
               this.UIElements = this.createUI();
           });
    }

    createUI() {
       const fileSelector = d3.select("#fileSelector");

       const row1 = fileSelector.append("div")
           .attr("class", "row mb-3");

       // File select
       const selectCol = row1.append("div")
           .attr("class", "col-8");

       // how do i add a blank first option using d3?
       // a: append a blank option to the data
       selectCol.append("select")
           .attr("class", "form-select")
           .on("change", () => this.handleFileChange())
           .selectAll("option")
           .data(this.fileList)
           .enter()
           .append("option")
           .attr("value", d => d.id)
           .text(d => d.name);

       // Navigation buttons
       const btnCol = row1.append("div")
           .attr("class", "col-4 d-flex");

       btnCol.append("button")
           .attr("class", "btn btn-outline-primary me-2")
           .text("Previous")
           .on("click", () => this.changeSelectedFile(-1));

       btnCol.append("button")
           .attr("class", "btn btn-outline-primary")
           .text("Next")
           .on("click", () => this.changeSelectedFile(+1));

       return {fileSelector, selectCol, btnCol};
    }

    changeSelectedFile(value, relative=true){
        let selectedIndex = this.fileList.findIndex(d => d.id === this.selectedFile);
        let newIndex = relative ? selectedIndex + value : value;
        newIndex = Math.max(0, Math.min(this.fileList.length - 1, newIndex));
        this.UIElements.selectCol.select("select").node().value = this.fileList[newIndex].id;
        // this doesnt trigger the change event
        this.handleFileChange();
    }

    handleFileChange(){
        let selectedFile = this.UIElements.selectCol.select("select").node().value;
        if (selectedFile === this.selectedFile){
            return;
        }
        this.selectedFile = selectedFile;
        console.log("File changed to", this.selectedFile);
        this.fileChangedCallback(this.selectedFile);
    }
}


class FileLoader{
    async loadFile(fileId){
//        console.log("Loading file", fileId);
//        return this.loadData();
        const data = await api.getFile(fileId);
        return new DataContainer(fileId, data.x, data.label, data.p);
    }

    loadData() {
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
}

export { FileSelector, FileLoader };