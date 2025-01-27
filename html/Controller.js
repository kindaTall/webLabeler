import { FileSelector, FileLoader } from './FileHandling.js';
import { Plotter } from './plotter.js';
import { PlotterConfig } from './plotConfig.js'
import { AudioPlayer } from './audioPlayer.js';



export class Controller {
    constructor() {
        this.plotter = null;
        this.fileSelector = new FileSelector(this.handleFileChange.bind(this));
        this.fileLoader = new FileLoader();
        this.audioPlayer = new AudioPlayer(this.getCurrentViewIndices.bind(this));
    }

    handleFileChange(selectedFile, preloadFiles) {
        this.fileLoader.loadFile(selectedFile)
            .then(data => {
                if (this.plotter) {
                    this.plotter.destroy();
                }
                const config = this.getConfig();
                this.plotter = new Plotter(data, "plot", config);
                this.audioPlayer.setData(data);
                this.fileLoader.preloadFiles(preloadFiles);
            });
    }

    getCurrentViewIndices(){
        if (!this.plotter) return null;
        const viewDomain = this.plotter.viewDomain;
        const indices = viewDomain.map(d => Math.round(d * 1395));
        return indices;
    }

    getConfig(){
        return PlotterConfig.getDefault();
    }
}