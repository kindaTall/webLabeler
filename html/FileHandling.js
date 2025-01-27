import { DataContainer, buildPreload } from "./DataContainer.js";
import { api } from './api.js';

const DEFAULT_CACHE_SIZE = 0;

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

    getFileIndex(fileId){
        return this.fileList.findIndex(d => d.id === fileId);
    }

    changeSelectedFile(value, relative=true){
        let selectedIndex = this.getFileIndex(this.selectedFile);
        let newIndex = relative ? selectedIndex + value : value;
        newIndex = Math.max(0, Math.min(this.fileList.length - 1, newIndex));
        this.UIElements.selectCol.select("select").node().value = this.fileList[newIndex].id;
        // this doesnt trigger the change event
        this.handleFileChange();
    }

    getPreloadFiles(){
        // need to decide what to preload. Will preload -1, 0 and (DEFAULT_CACHE_SIZE - 2) files relative to the current file
        let currentIndex = this.getFileIndex(this.selectedFile);
        let startPreloadIndex = Math.max(0, currentIndex - 1);
        let endPreloadIndex = Math.min(this.fileList.length - 1, startPreloadIndex + DEFAULT_CACHE_SIZE - 1);
        startPreloadIndex = Math.max(0, endPreloadIndex - DEFAULT_CACHE_SIZE + 1);
        return this.fileList.slice(startPreloadIndex, endPreloadIndex + 1).map(d => d.id);
    }

    handleFileChange(){
        if (!this.updateSelectedFile()) return;
        console.log("File changed to", this.selectedFile);
        let preloadFiles = this.getPreloadFiles();
        this.fileChangedCallback(this.selectedFile, preloadFiles);
    }

    updateSelectedFile(){
        let selectedFile = this.UIElements.selectCol.select("select").node().value;
        if (selectedFile === this.selectedFile) return false;

        this.selectedFile = selectedFile;
        return true;
    }
}


class FileLoader {
    constructor(maxCacheSize = DEFAULT_CACHE_SIZE){
        this.maxCacheSize = maxCacheSize;
        this.requestedFiles = new Set();
        this.cache = new Map();
    }

    async loadFile(fileId) {
        if (this.cache.has(fileId) && this.cache.get(fileId).type === 'dataContainer') {
            let metaContainer = this.cache.get(fileId);
            metaContainer.lastAccessed = Date.now();
            return metaContainer.data;
        }

        const data = (this.cache.has(fileId) && this.cache.get(fileId).type === 'preload') ?
                this.cache.get(fileId).data :
                await api.getFile(fileId);

        const container = new DataContainer(fileId, data.x, data.label, data.p, data?.noise, data?.metaData);
        const metaContainer = {
            lastAccessed: Date.now(),
            data: container,
            type: 'dataContainer'
        };
        this.cache.set(fileId, metaContainer);
        this.cleanupCache();
        return container;
    }

    async preloadFile(fileId){
        if (this.cache.has(fileId)) {
            console.log(`File already in cache: ${fileId}: ${this.cache.get(fileId).type}`);
            return;
        }
        console.log(`Preloading file: ${fileId}`);
        const data = await api.getFile(fileId);
        const container = buildPreload(fileId, data.x, data.label, data.p);
        const metaContainer = {
            lastAccessed: Date.now(),
            data: container,
            type: 'preload'
        };
        this.cache.set(fileId, metaContainer);
        console.log(`Preloaded file: ${fileId}`);
        this.cleanupCache();
    }

    cleanupCache() {
        if (this.cache.size <= this.maxCacheSize) {
            return;
        }
        const keys = Array.from(this.cache.keys());
        const keysToRemove = keys.filter(k => !this.requestedFiles.has(k));
        // sort by last accessed
        keysToRemove.sort((a, b) => this.cache.get(a).lastAccessed - this.cache.get(b).lastAccessed);

        let nToRemove = this.cache.size - this.maxCacheSize;

        // remove up to nToRemove or all keysToRemove what ever is smaller
        for (let i = 0; i < nToRemove && i < keysToRemove.length; i++) {
            this.cache.delete(keysToRemove[i]);
        }
    }

    async preloadFiles(fileIds) {
        this.requestedFiles = new Set(fileIds);
        fileIds.forEach(id => this.preloadFile(id));
    }
}


export { FileSelector, FileLoader };