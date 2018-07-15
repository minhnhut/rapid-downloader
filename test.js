const {DownloadWorker, utils} = require("./index");

// Multi connections
// const worker = new DownloadWorker("http://ipv4.download.thinkbroadband.com/50MB.zip", "50.file");
// worker.on('ready', () => {
//     worker.on('start', () => console.log('started'))
//     worker.on('progress', (progress) => {
//         const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond);
//         console.log(`${progress.percent}% - ${speed}`)
//     });
//     worker.start();
// });

// Single connection
const worker = new DownloadWorker("http://ipv4.download.thinkbroadband.com/50MB.zip", "50.single", {
    forceSingleConnection: true
});
worker.on('ready', () => {
    worker.on('start', () => console.log('started'))
    worker.on('progress', (progress) => {
        const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond);
        console.log(`${progress.percent}% - ${speed}`)
    });
    worker.start();
});