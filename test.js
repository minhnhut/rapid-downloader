const {DownloadWorker, utils} = require("./index");

// Multi connections
const worker = new DownloadWorker("http://speedtest.tokyo2.linode.com/100MB-tokyo2.bin", "100MB-tokyo2.zip", {
    maxConnections: 8
});
worker.on('ready', () => {
    worker.on('start', () => console.log('started'))
    worker.on('progress', (progress) => {
        const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond, 2);
        console.log(`${progress.completedPercent}% - ${speed}`)
    });
    worker.on('finishing', () => console.log('Download is finishing'));
    worker.on('end', () => console.log('Download is done'));
    worker.start();
});

// Single connection
// const worker = new DownloadWorker("http://speedtest.tokyo2.linode.com/100MB-tokyo2.bin", "100MB.zip", {
//     forceSingleConnection: true
// });
// worker.on('ready', () => {
//     worker.on('start', () => console.log('started'))
//     worker.on('progress', (progress) => {
//         const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond, 2);
//         console.log(`${progress.completedPercent}% - ${speed}`)
//     });
//     worker.on('finishing', () => console.log('Download is finishing'));
//     worker.on('end', () => console.log('Download is done'));
//     worker.on('error', error => console.log(error));
//     worker.start();
// });