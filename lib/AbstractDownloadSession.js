const EventEmitter = require("events");

module.exports = class extends EventEmitter {
    constructor(url, savePath) {
        super();
        this.url = url;
        this.savePath = savePath;
        this.status = "idle"
    }

    start() {
        this.emit('start');
        this._downloadFile(this.url, this.savePath);
    }

    stop() {
        this.status = "idle"
    }

    _downloadFile(url, savePath) {
        // should be implemented later, in subclass
    }
};