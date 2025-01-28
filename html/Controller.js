import { FileSelector, FileLoader } from './FileHandling.js';
import { Plotter } from './plotter.js';
import { PlotterConfig } from './plotConfig.js'
import { AudioPlayer } from './audioPlayer.js';
import { DataContainer } from "./dataContainer.js";



export class Controller {
    constructor() {
        this.plotter = null;
        this.fileSelector = new FileSelector(this.handleFileChange.bind(this));
        this.fileLoader = new FileLoader();
        this.audioPlayer = new AudioPlayer(this.getCurrentViewIndices.bind(this));
    }

    async handleFileChange(selectedFile, preloadFiles) {
        try {
            // Load and plot first - critical path
            const data = await this.fileLoader.loadFile(selectedFile);
            const container = new DataContainer(selectedFile, data.x, data.label, data.p);

            if (this.plotter) {
                this.plotter.destroy();
            }
            const config = this.getConfig();
            this.plotter = new Plotter(container, "plot", config);

            // Force browser to render by creating a new macrotask
            await new Promise(resolve => setTimeout(resolve, 0));

            // Heavy calculations in background
            Promise.all([
                this.audioPlayer.setData(container),
                this.fileLoader.preloadFiles(preloadFiles)
            ]).catch(err => console.error('Background tasks error:', err));

        } catch (err) {
            console.error('Error in file handling:', err);
        }
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