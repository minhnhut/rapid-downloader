const R = require('ramda')
const fs = require('fs')

const devideTo1024ThenRound = R.compose(
    Math.floor,
    R.divide(R.__, 1024)
);
const byteToKb = devideTo1024ThenRound;
const byteToMb = R.compose(
    devideTo1024ThenRound,
    byteToKb
);


const dynamicSpeedUnitDisplay = function(byte) {
    let currentUnit = byte;
    if (byteToKb(byte) < 1) return byte + "B/s";
    if (byteToMb(byte) < 1) return byteToKb(byte) + "KB/s";
    return byteToMb(byte) + "MB/s";    
}

const calculateCompletedPercent = function(downloadedBytes, totalBytes) {
    return Math.floor(parseFloat(downloadedBytes*10000)/totalBytes) / 100;
}

const joinFiles = (filePaths, finalFilePath, callback, deleteFile) => {    
    if (typeof deleteFile === 'undefined') {
        deleteFile = true;
    }
    const ws = fs.createWriteStream(finalFilePath);
    concatFile(filePaths, ws, callback, deleteFile);
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