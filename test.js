const SimpleDownloadSession = require("./lib/SimpleDownloadSession");
const Utils = require("./lib/Utils");

const a = new SimpleDownloadSession("http://ipv4.download.thinkbroadband.com/50MB.zip");
a.on('start', () => console.log('started'))
a.on('progress', (progress) => {
    const speed = Utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond);
    console.log(`${progress.percent}% - ${speed}`)
});
a.start();