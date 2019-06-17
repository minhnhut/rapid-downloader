const fjs = require('functional.js')
const fs = require('fs')

const devideTo1024ThenRound = fjs.compose(
    x => x / Math.pow(10,4),
    Math.floor,
    x => x * Math.pow(10,4),
    x => x/1024
);
const byteToKb = devideTo1024ThenRound;
const byteToMb = fjs.compose(
    devideTo1024ThenRound,
    byteToKb
);

const dynamicSpeedUnitDisplayWithDecimal = (byte) => {
    if (byteToKb(byte) < 1) return [byte, "B/s"];
    if (byteToMb(byte) < 1) return [byteToKb(byte), "KB/s"];
    return [byteToMb(byte), "MB/s"];
}

const dynamicSpeedUnitDisplay = (byte, decimal) => {
    decimal = decimal ? decimal : 0;
    const raw = dynamicSpeedUnitDisplayWithDecimal(byte);
    raw[0] = raw[0].toFixed(decimal);
    return raw.join("");
}

const calculateCompletedPercent = function(downloadedBytes, totalBytes) {
    return Math.floor(parseFloat(downloadedBytes*10000)/totalBytes) / 100;
}

const joinFiles = (filePaths, finalFilePath, callback, deleteFile) => {
    if (typeof deleteFile === 'undefined') {
        deleteFile = true;
    }
    if (filePaths.length == 1) {
        fs.rename(filePaths[0], finalFilePath, callback);
    } else {
        const ws = fs.createWriteStream(finalFilePath);
        concatFile(filePaths, ws, callback, deleteFile);
    }
}

const concatFile = (filePaths, ws, callback, deleteFile) => {
    filePath = filePaths.shift();
    const rs = fs.createReadStream(filePath);
    rs.pipe(ws, {end: false});
    rs.on('end', () => {
        rs.close();
        if (deleteFile) {
            fs.unlink(filePath, () => {});
        }
        if (filePaths.length) {
            concatFile(filePaths, ws, callback, deleteFile);
        } else {
            if (callback) {
                callback();
            }
            ws.close();
        }
    });
}

module.exports = {
    devideTo1024ThenRound,
    byteToKb,
    byteToMb,
    dynamicSpeedUnitDisplay,
    calculateCompletedPercent,
    joinFiles
};