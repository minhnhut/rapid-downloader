const path = require("path")
const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const { finished } = require('stream')
const AbstractDownloadSession = require("./AbstractDownloadSession");

module.exports = class extends AbstractDownloadSession {
    _downloadFile(downloadUrl, toFile) {
        const filename = path.basename(downloadUrl);
        const savePath = toFile ? toFile : path.resolve(process.cwd(), filename);
        const file = fs.createWriteStream(savePath);
        const requestOptions = url.parse(downloadUrl);
        requestOptions.timeout = 3000;
        const httpLibrary = requestOptions.protocol.indexOf("https") === 0 ? https : http;
        finished(
            httpLibrary.get(requestOptions, res => {
                this.lastSecondDownloadedBytes = 0;
                this.downloadedBytes = 0;
                this.totalBytes = res.headers["content-length"];
                this.bytesPerSecond = 0;
                res.pipe(file);
                this._handleResponse(res);
            }),
            e => e && this._emitError(e)
        );
        this.status = "downloading"
    };
};