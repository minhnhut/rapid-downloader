const {DownloadWorker, utils} = require("./index");

// Multi connections
const worker = new DownloadWorker("http://mirror.filearena.net/pub/speed/SpeedTest_64MB.dat?_ga=2.217946004.329296576.1531622230-1523652149.1531622230", "multi.file", {
    maxConnections: 8
});
worker.on('ready', () => {
    worker.on('start', () => console.log('started'))
    worker.on('progress', (progress) => {
        const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond);
        console.log(`${progress.percent}% - ${speed}`)
    });
    worker.start();
});

// Single connection
// const worker = new DownloadWorker("http://mirror.filearena.net/pub/speed/SpeedTest_64MB.dat?_ga=2.217946004.329296576.1531622230-1523652149.1531622230", "single.file", {
//     forceSingleConnection: true
// });
// worker.on('ready', () => {
//     worker.on('start', () => console.log('started'))
//     worker.on('progress', (progress) => {
//         const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond);
//         console.log(`${progress.percent}% - ${speed}`)
//     });
//     worker.start();
// });