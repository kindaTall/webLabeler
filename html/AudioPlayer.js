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
    }

    setupUI() {
        this.playButton = this.container.append("button")
            .attr("class", "btn btn-outline-primary me-2")
            .text("Play")
            .style("display", "none")
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
        if (!this.data) return;

        // Get audio data for current view
        const clippedAudio = await this.getAudio();

        // Lazy initialize audio context (browser requirement)
        this.audioContext ||= new AudioContext();

        // Create and configure audio buffer
        const buffer = this.audioContext.createBuffer(
            1,  // mono channel
            clippedAudio.length,
            this.sampleRate * this.playbackSpeed
        );

        // Fill buffer with processed audio data
        buffer.getChannelData(0).set(clippedAudio);

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
        this.playButton.style("display", null);
        this.clippedAudio = this.calculateClipRange();
    }

    async calculateClipRange() {
        const signal = this.data.signal;

        // Calculate signal statistics for normalization
        const mean = d3.mean(signal);
        const quants = [
            d3.quantile(signal, 0.15),  // Lower quantile
            d3.quantile(signal, 0.85)   // Upper quantile
        ];

        // Calculate amplitudes relative to mean
        const amplitudes = quants.map(q => Math.abs(q - mean));

        // Scale to INT16 range for audio playback
        const maxINT16 = 32767;
        const scale = maxINT16 / Math.min(amplitudes[0], amplitudes[1]);

        // Convert signal to INT16 audio samples
        const clippedAudio = new Int16Array(signal.length);
        for (let i = 0; i < signal.length; i++) {
            clippedAudio[i] = Math.round((signal[i] - mean) * scale);
        }
        return clippedAudio;
    }

    async getAudio() {
        const indices = this.getCurrentViewIndices();
        const clippedAudio = await this.clippedAudio;
        return clippedAudio.slice(indices[0], indices[1]);
    }
}