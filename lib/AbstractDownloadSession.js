const EventEmitter = require("events")
const { finished } = require('stream')

module.exports = class extends EventEmitter {
    constructor(url, savePath) {
        super();
        this.url = url;
        this.savePath = savePath;
        this.status = "idle";
        this.downloadedBytes = 0;
        this.totalBytes = 0;
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
        this.bytesPerSecond = 0;
        this.emit('end');
    }

    _emitError(e) {
        this.bytesPerSecond = 0;
        this.emit('error', e);
    }

    _downloadFile(url, savePath) {
        // should be implemented later, in subclass
    }

    _handleResponse(res) {
        this.request = res;
        res.on("data", chunk => {
            this.downloadedBytes += chunk.length;
        });
        finished(res, e => e
            ? this._emitError(e)
            : this._emitEnd()
        );
    }
};