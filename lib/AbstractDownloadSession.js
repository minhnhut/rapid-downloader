const EventEmitter = require("events")
const fjs = require("functional.js")
const Utils = require('./Utils')

module.exports = class extends EventEmitter {
    constructor(url, savePath) {
        super();
        this.url = url;
        this.savePath = savePath;
        this.status = "idle";
        this.lastSecondDownloadedBytes = 0;
        this.downloadedBytes = 0;
        this.totalBytes = 0;
        this.bytesPerSecond = 0;
        this.completedPercent = 0;
        this.lastSecond = 0;
        this.paused = false;
        this.request = null;
    }

    start() {
        if (!this.request) {
            this.emit('start');
            this.status = 'downloading';
            this._downloadFile(this.url, this.savePath);
        }
    }

    resume() {
        if (this.paused) {
            this.paused = false;
            this.request.resume();
        }
    }

    pause() {
        if (this.request) {
            this.status = "paused";
            this.paused = true;
            this.bytesPerSecond = 0;
            this.request.pause();
        }
    }

    stop() {
        if (this.request) {
            this.status = "idle";
            this.paused = false;
            this.request.unpipe();
            this.request.destroy();
            this.bytesPerSecond = 0;
            this.request = null;
        }
    }

    _emitProgress() {
        this.emit("progress", {
            totalBytes: this.totalBytes,
            downloadedBytes: this.downloadedBytes,
            percent: this.completedPercent,
            bytesPerSecond: this.bytesPerSecond
        });
    }

    _emitEnd() {
        console.log('end');
        this.emit('end');
    }

    _emitError(e) {
        console.log(e);
        this.emit('error', e);
    }

    _downloadFile(url, savePath) {
        // should be implemented later, in subclass
    }

    _handleResponse(res) {
        this.request = res;
        this.lastSecond = Date.now();
        const diffWithNow = (milis) => Date.now() - milis;
        const milisToSeconds = fjs.compose(
            x => x/1000,
            parseFloat
        );
        res.on('timeout', (e) => {
            console.log("timeout");
        })
        res.on("data", chunk => {
            this.downloadedBytes += chunk.length;
            const diffWithLastSecond = diffWithNow(this.lastSecond);
            if (diffWithLastSecond < 1000) {
                this.lastSecondDownloadedBytes += chunk.length;
            } else {
                this.bytesPerSecond = Math.floor(this.lastSecondDownloadedBytes / milisToSeconds(diffWithLastSecond));
                this.lastSecond = Date.now();
                this.lastSecondDownloadedBytes = 0;
                this.completedPercent = Utils.calculateCompletedPercent(this.downloadedBytes, this.totalBytes);
                this._emitProgress();
            }
        });
        res.on('end', () => this._emitEnd());
        res.on('error', (e) => this._emitError(e));
    }
};