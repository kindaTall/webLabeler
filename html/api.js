class APIService {
   constructor(baseURL = '/api') {
       this.baseURL = baseURL;
   }

   async getFileList() {
       const response = await fetch(`${this.baseURL}/get-file-list`);
       const text = await response.text();
       const json = JSON.parse(text);
       return json;
   }
   async getFile(filename) {
       const [meta, data] = await Promise.all([
           this.getFileMeta(filename),
           this.getFileData(filename)
       ]);
       return {
           x: data,
           p: meta.p,
           label: meta.label
       };
   }

   async getFileMeta(filename) {
        const response = await fetch(`${this.baseURL}/get-file-meta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const result =  await response.json();
        return result;
    }

    async getFileData(filename) {
        const response = await fetch(`${this.baseURL}/get-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const arrayBuffer = await response.arrayBuffer();
        return new Int32Array(arrayBuffer);
    }

    async updateLabels(filename, labels) {
        const response = await fetch(`${this.baseURL}/update-labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, labels })
        });
        return await response.json();
    }

    async getFilterPresets() {
        const response = await fetch(`${this.baseURL}/filter-presets`);
        return await response.json();
    }

    async saveFilterPresets(presets) {
        const response = await fetch(`${this.baseURL}/filter-presets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presets })
        });
        return await response.json();
    }

}

export const api = new APIService();