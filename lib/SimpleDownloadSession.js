const path = require("path")
const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const AbstractDownloadSession = require("./AbstractDownloadSession");

module.exports = class extends AbstractDownloadSession {
    _downloadFile(downloadUrl, toFile) {
        const filename = path.basename(downloadUrl);
        const savePath = toFile ? toFile : path.resolve(process.cwd(), filename);
        const file = fs.createWriteStream(savePath);
        const requestOptions = url.parse(downloadUrl);
        const httpLibrary = requestOptions.protocol === "https" ? https : http;
        httpLibrary.get(requestOptions, res => {
            this.lastSecondDownloadedBytes = 0;
            this.downloadedBytes = 0;
            this.totalBytes = res.headers["content-length"];
            this.bytesPerSecond = 0;

            res.pipe(file);
            this._handleResponse(res);
        });
        this.status = "downloading"
    };
};