const {DownloadWorker, utils} = require("./index");

// Multi connections
const worker = new DownloadWorker("http://mirror.filearena.net/pub/speed/SpeedTest_64MB.dat?_ga=2.217946004.329296576.1531622230-1523652149.1531622230", "movie.mkv", {
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
// const worker = new DownloadWorker("http://s57.linksvip.net/s/043/y0CXe39c6hAEXW8Qn1LizZ9PICy+l5s4j4lV7uk5uUrK3QO2Lt2qOyAIIX6DJLbAJK+yzZQrm9LbEYnK/super.troopers.2.2018.1080p.bluray.x264-drones.mkv", "movie.mkv", {
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