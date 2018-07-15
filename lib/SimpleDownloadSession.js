const path = require("path")
const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const R = require("ramda")
const AbstractDownloadSession = require("./AbstractDownloadSession");

module.exports = class extends AbstractDownloadSession {
    _downloadFile(downloadUrl, toFile) {
        const filename = path.basename(downloadUrl);
        const savePath = toFile ? toFile : path.resolve(process.cwd(), filename);
        const file = fs.createWriteStream(savePath);
        const parsedUrl = new url.URL(downloadUrl);

        const requestOptions = url.parse(downloadUrl);
        
        const httpLibrary = parsedUrl.protocol === "https" ? https : http;
        httpLibrary.get(requestOptions, res => {
            let lastSecond = Date.now();
            const diffWithNow = (milis) => Date.now() - milis;
            const milisToSeconds = R.compose(
                R.divide(R.__, 1000),
                parseFloat
            );
            let lastSecondDownloadedBytes = 0;
            res.pipe(file);
            let downloadedBytes = 0;
            const totalBytes = res.headers["content-length"];
            let bytesPerSecond = 0;

            res.on("data", chunk => {
                downloadedBytes += chunk.length;
                const diffWithLastSecond = diffWithNow(lastSecond);
                if (diffWithLastSecond < 1000) {
                    lastSecondDownloadedBytes += chunk.length;
                } else {
                    bytesPerSecond = Math.floor(lastSecondDownloadedBytes / milisToSeconds(diffWithLastSecond));
                    lastSecond = Date.now();
                    lastSecondDownloadedBytes = 0;
                }
                const percent = Math.floor(parseFloat(downloadedBytes*10000)/totalBytes) / 100;
                this.emit("progress", {
                    totalBytes: totalBytes,
                    downloadedBytes: downloadedBytes,
                    percent: percent,
                    bytesPerSecond: bytesPerSecond
                });
            });

            res.on("end", () => this.emit("end"));
        });
        this.status = "downloading"
    };
};