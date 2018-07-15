const {DownloadWorker, utils} = require("./index");

// Multi connections
const worker = new DownloadWorker("http://ipv4.download.thinkbroadband.com/50MB.zip", "50MB.zip", {
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
// const worker = new DownloadWorker("http://s28.linksvip.net/s/030/FnMjYR42ek7kHIatUl2ydQi2LJt3e8rGYTUmDVeNPLChmc2utvZm1Q2NxFzmmQ72OWjAStViyKZ9z3Nu/Rampage.2018.1080p.WEB-DL.DD5.1.H264-FGT.mkv", "single.file", {
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