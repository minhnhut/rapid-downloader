var path = require("path")
const http = require("http")
const https = require("https")
var fs = require("fs")
const url = require("url")
const R = require("ramda")

function downloadFileRange(downloadUrl, fileStream, fromByte, toByte) {
    const parsedUrl = new url.URL(downloadUrl);
    const requestOptions = url.parse(downloadUrl);
    requestOptions.headers = {
        "range": `bytes=${fromByte}-${toByte}`
    }
    const httpLibrary = parsedUrl.protocol === "https" ? https : http;
    httpLibrary.get(requestOptions, res => {
        let lastSecond = Date.now();
        const diffWithNow = (milis) => Date.now() - milis;
        const milisToSeconds = R.compose(
            R.divide(R.__, 1000),
            parseFloat
        );
        const devideTo1024ThenRound = R.compose(
            Math.floor,
            R.divide(R.__, 1024)
        );
        const byteToKb = devideTo1024ThenRound;
        const byteToMb = R.compose(
            devideTo1024ThenRound,
            byteToKb
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
                console.log(diffWithLastSecond);
                bytesPerSecond = Math.floor(lastSecondDownloadedBytes / milisToSeconds(diffWithLastSecond));
                lastSecond = Date.now();
                lastSecondDownloadedBytes = 0;
            }
            const percent = Math.floor(parseFloat(downloadedBytes*10000)/totalBytes) / 100;
            const speed = byteToKb(bytesPerSecond);
            console.log(`${percent}% - ${speed} KB/s`);
        });
    });
}

function downloadFile(downloadUrl, toFile) {
    const filename = path.basename(downloadUrl);
    const savePath = toFile ? toFile : path.resolve(__dirname, filename);
    const file = fs.createWriteStream(savePath);
    const parsedUrl = new url.URL(downloadUrl);

    const requestOptions = url.parse(downloadUrl);
    requestOptions.headers = {
        "range": "bytes=0-1023"
    }

    const httpLibrary = parsedUrl.protocol === "https" ? https : http;
    httpLibrary.get(requestOptions, res => {
        let lastSecond = Date.now();
        const diffWithNow = (milis) => Date.now() - milis;
        const milisToSeconds = R.compose(
            R.divide(R.__, 1000),
            parseFloat
        );
        const devideTo1024ThenRound = R.compose(
            Math.floor,
            R.divide(R.__, 1024)
        );
        const byteToKb = devideTo1024ThenRound;
        const byteToMb = R.compose(
            devideTo1024ThenRound,
            byteToKb
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
                console.log(diffWithLastSecond);
                bytesPerSecond = Math.floor(lastSecondDownloadedBytes / milisToSeconds(diffWithLastSecond));
                lastSecond = Date.now();
                lastSecondDownloadedBytes = 0;
            }
            const percent = Math.floor(parseFloat(downloadedBytes*10000)/totalBytes) / 100;
            const speed = byteToKb(bytesPerSecond);
            console.log(`${percent}% - ${speed} KB/s`);
        });
    });
}
downloadFile("http://ipv4.download.thinkbroadband.com/50MB.zip");
