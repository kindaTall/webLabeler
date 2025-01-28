// fileSelector.js
import { api } from './api.js';
import { DataContainer } from "./dataContainer.js";

export class FileSelector {
    constructor(fileChangedCallback) {
        this.fileList = [{id: "null", name: "Select a file"}];
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

    getFileIndex(fileId) {
        return this.fileList.findIndex(d => d.id === fileId);
    }

    changeSelectedFile(value, relative=true) {
        let selectedIndex = this.getFileIndex(this.selectedFile);
        let newIndex = relative ? selectedIndex + value : value;
        newIndex = Math.max(0, Math.min(this.fileList.length - 1, newIndex));
        this.UIElements.selectCol.select("select").node().value = this.fileList[newIndex].id;
        this.handleFileChange();
    }

    handleFileChange() {
        if (!this.updateSelectedFile()) return;
        console.log("File changed to", this.selectedFile);
        this.fileChangedCallback(this.selectedFile);
    }

    updateSelectedFile() {
        let selectedFile = this.UIElements.selectCol.select("select").node().value;
        if (selectedFile === this.selectedFile) return false;
        
        this.selectedFile = selectedFile;
        return true;
    }
}

// fileLoader.js

const DEFAULT_CACHE_SIZE = 5;  // Reasonable default cache size

export class FileLoader {
    constructor(maxCacheSize = DEFAULT_CACHE_SIZE) {
        this.maxCacheSize = maxCacheSize;
        this.cache = new Map();
    }

    async loadFile(fileId) {
        // Return cached data if available
        if (this.cache.has(fileId)) {
            const metaContainer = this.cache.get(fileId);
            metaContainer.lastAccessed = Date.now();
            return metaContainer.data;
        }

        // Load and cache new data
        const data = await api.getFile(fileId);
        const container = new DataContainer(fileId, data.x, data.label, data.p);
        
        const metaContainer = {
            lastAccessed: Date.now(),
            data: container,
            type: 'dataContainer'  // Keep type for future extensibility
        };
        
        this.cache.set(fileId, metaContainer);
        this.cleanupCache();
        
        return container;
    }

    cleanupCache() {
        if (this.cache.size <= this.maxCacheSize) {
            return;
        }

        // Sort by last accessed time and remove oldest entries
        const entries = Array.from(this.cache.entries());
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        
        const numToRemove = this.cache.size - this.maxCacheSize;
        entries.slice(0, numToRemove).forEach(([key]) => {
            this.cache.delete(key);
        });
    }
}