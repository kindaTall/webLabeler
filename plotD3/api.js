class APIService {
   constructor(baseURL = '/api') {
       this.baseURL = baseURL;
   }

   async getFileList() {
       const response = await fetch(`${this.baseURL}/get-file-list`);
       return await response.json();
   }

   async getFileMeta(filename) {
       const response = await fetch(`${this.baseURL}/get-file-meta/${filename}`);
       return await response.json();
   }

   async getFileData(filename) {
       const response = await fetch(`${this.baseURL}/get-file/${filename}`);
       const arrayBuffer = await response.arrayBuffer();
       return new Int32Array(arrayBuffer);
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

   async updateLabels(filename, labels) {
       const response = await fetch(`${this.baseURL}/update-labels/${filename}`, {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
           },
           body: JSON.stringify({ labels })
       });
       return await response.json();
   }

}

export const api = new APIService();