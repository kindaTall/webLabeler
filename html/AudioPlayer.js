export class AudioPlayer {
    constructor(getCurrentViewIndices) {
        // Callback to get current view range from controller
        this.getCurrentViewIndices = getCurrentViewIndices;
        // Audio state
        this.playing = false;
        this.audioContext = null;
        this.source = null;
        // Audio configuration
        this.sampleRate = 1395;  // Raw signal sample rate
        this.playbackSpeed = 256;  // Speed multiplier for audible playback
        // UI setup
        this.container = d3.select("#audioPlayer");
        this.setupUI();
        // Data storage
        this.data = null;  // Raw input data
        this.clippedAudio = null;  // Pre-processed Int16 audio data
        // Setup worker
        this.worker = new Worker(new URL('./audioWorker.js', import.meta.url), { type: 'module' });
        this.setupWorker();
    }

    setupWorker() {
        this.worker.onmessage = (e) => {
            this.clippedAudio = e.data;
            this.playButton.attr("disabled", null);  // Enable button when processing is done
        };
    }

    setupUI() {
        this.playButton = this.container.append("button")
            .attr("class", "btn btn-outline-primary me-2")
            .text("Play")
            .attr("disabled", "disabled")  // Start disabled until audio is processed
            .on("click", () => this.toggle());
    }

    setPlaying(isPlaying) {
        this.playing = isPlaying;
        this.playButton.text(isPlaying ? "Pause" : "Play");
    }

    toggle() {
        this.setPlaying(!this.playing);
        this.playing ? this.play() : this.pause();
    }

    async play() {
        if (!this.data || !this.clippedAudio) return;

        // Get audio data for current view
        const audioData = await this.getAudio();

        // Lazy initialize audio context (browser requirement)
        this.audioContext ||= new AudioContext();

        // Create and configure audio buffer
        const buffer = this.audioContext.createBuffer(
            1,  // mono channel
            audioData.length,
            this.sampleRate * this.playbackSpeed
        );

        // Fill buffer with processed audio data
        buffer.getChannelData(0).set(audioData);

        // Create and start audio source
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.onended = () => this.setPlaying(false);
        source.start();
        this.source = source;
    }

    pause() {
        this.source?.stop();
    }

    async setData(data) {
        this.data = data;
        // Start processing in worker
        this.playButton.attr("disabled", "disabled");  // Disable while processing
        this.worker.postMessage(this.data.signal);
    }

    async getAudio() {
        const indices = this.getCurrentViewIndices();
        return this.clippedAudio.slice(indices[0], indices[1]);
    }
}