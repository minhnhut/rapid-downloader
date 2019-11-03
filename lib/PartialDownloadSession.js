const path = require("path")
const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const { finished } = require('stream')
const AbstractDownloadSession = require("./AbstractDownloadSession");

module.exports = class extends AbstractDownloadSession {
    constructor(downloadUrl, savePath, fromBytes, toBytes, index) {
        super(downloadUrl, savePath);
        this.fromBytes = fromBytes;
        this.toBytes = toBytes;
        this.index = index;
        this.totalBytes = toBytes - fromBytes + 1; // inclusive
        this.temporaryPath = "";
    }

    _downloadFile(downloadUrl, toFile) {
        const filename = path.basename(downloadUrl);
        const savePath = toFile ? toFile : path.resolve(process.cwd(), filename);
        this.temporaryPath = savePath + "." + this.index; 
        // const file = fs.createWriteStream(savePath + Date.now(), {start: this.fromBytes});
        const file = fs.createWriteStream(this.temporaryPath);
        const requestOptions = url.parse(downloadUrl);
        requestOptions.headers = {};
        requestOptions.headers["Range"] = `bytes=${this.fromBytes}-${this.toBytes}`
        requestOptions.timeout = 3000;
        const httpLibrary = requestOptions.protocol.indexOf("https") === 0 ? https : http;
        const res = httpLibrary.get(requestOptions, res => {
            this.lastSecondDownloadedBytes = 0;
            this.downloadedBytes = 0;
            this.bytesPerSecond = 0;
            res.pipe(file);
            this._handleResponse(res);
        })
        finished(res, e => e && this._emitError(e));
        this.status = "downloading";
    };
};