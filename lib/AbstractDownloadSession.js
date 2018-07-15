const EventEmitter = require("events")
const R = require("ramda")
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
    }

    start() {
        this.emit('start');
        this._downloadFile(this.url, this.savePath);
    }

    stop() {
        this.status = "idle"
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
        this.emit('end');
    }

    _downloadFile(url, savePath) {
        // should be implemented later, in subclass
    }

    _handleResponse(res) {
        this.lastSecond = Date.now();
        const diffWithNow = (milis) => Date.now() - milis;
        const milisToSeconds = R.compose(
            R.divide(R.__, 1000),
            parseFloat
        );

        res.on("data", chunk => {
            this.downloadedBytes += chunk.length;
            const diffWithLastSecond = diffWithNow(this.lastSecond);
            if (diffWithLastSecond < 1000) {
                this.lastSecondDownloadedBytes += chunk.length;
            } else {
                this.bytesPerSecond = Math.floor(this.lastSecondDownloadedBytes / milisToSeconds(diffWithLastSecond));
                this.lastSecond = Date.now();
                this.lastSecondDownloadedBytes = 0;
            }
            this.completedPercent = Utils.calculateCompletedPercent(this.downloadedBytes, this.totalBytes);
            this._emitProgress();
        });
        this._emitEnd();
    }
};