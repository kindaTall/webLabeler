import { FileSelector, FileLoader } from './FileHandling.js';
import { Plotter } from './plotter.js';
import { PlotterConfig } from './plotConfig.js'



export class Controller {
    constructor() {
        this.plotter = null;
        this.fileSelector = new FileSelector(this.handleFileChange.bind(this));
        this.fileLoader = new FileLoader();
    }

    handleFileChange(selectedFile) {
        this.fileLoader.loadFile(selectedFile)
            .then(data => {
                if (this.plotter) {
                    this.plotter.destroy();
                }
                const config = this.getConfig();
                this.plotter = new Plotter(data, "plot", config);
            });
    }

    getConfig(){
        return PlotterConfig.getDefault();
    }
}