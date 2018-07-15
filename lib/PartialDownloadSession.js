const path = require("path")
const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const R = require("ramda")
const AbstractDownloadSession = require("./AbstractDownloadSession");

module.exports = class extends AbstractDownloadSession {
    constructor(downloadUrl, savePath, fromBytes, toBytes) {
        super(downloadUrl, savePath);
        this.fromBytes = fromBytes;
        this.toBytes = toBytes;
        this.totalBytes = toBytes - fromBytes + 1; // inclusive
    }

    _downloadFile(downloadUrl, toFile) {
        const filename = path.basename(downloadUrl);
        const savePath = toFile ? toFile : path.resolve(process.cwd(), filename);
        const file = fs.createWriteStream(savePath, {start: this.fromBytes});
        const requestOptions = url.parse(downloadUrl);
        requestOptions.headers = {};
        requestOptions.headers["Range"] = `bytes=${this.fromBytes}-${this.toBytes}`
        const httpLibrary = requestOptions.protocol === "https" ? https : http;
        httpLibrary.get(requestOptions, res => {
            this.lastSecondDownloadedBytes = 0;
            this.downloadedBytes = 0;
            this.bytesPerSecond = 0;
            res.pipe(file);
            this._handleResponse(res);
        });
        this.status = "downloading"
    };
};