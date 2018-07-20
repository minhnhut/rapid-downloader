# rapid-downloader
Ez to use accelerated downloader for Node.js enviroment. Greatly increase download speed by taking adavantage of node's non-io-blocking, divide the job into multiple network connections.

In a hurry? There is example in the end. Skip bellow. Go to last section.

## What is inside the box

- DownloadWorker: the core conception of downloading, and managing download connections. One worker mean one file that need to be downloaded.
- utils: Cause it is not a class, I named it lowercase. This object contains many utilities functions to work with files/DownloadWorker's result. 

P/s: The most useful one inside utils is **utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond, 2)**
That function is for making human-readable download speed string from raw progress result of DownloadWorker. For more details, see example bellow.
The most useful one is

## What happen inside DownloadWorker

DownloadWorker a.k.a worker, will first try to make a HEAD request. To determine if source server is supporting [Range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests). After this point, there will be two cases:

1. If it is advertised as ranges is supported, worker will then initilize multiples connection which is divided perfectly to download the file. Each connections will download it's part to seperated file. After all connections done it's jobs. Worker will then join all partial files into one. The download is completed.

2. If worker decided that source server doesn't have ranges support, it will initilize only one connection. Source file will be then transfered byte by byte to single local file. After that single connection done it's job. The download is completed.

## Available DownloadWorker options, and its default value

```javascript
const options = {
    // Number of connections should be used
    // the bigger number, the faster download be
    // ... and the greater stress on your network also
    // default: 4
    maxConnections: 4, 

    // Force DownloadWorker to use multiple connections
    // even target server is saying that ranges is not support
    // (may rise an error, if target server is really doesn't support range requests)
    // default: false
    forceMultipleConnections : false,

    // Force single connection
    // oposite to forceMultipleConnections, force worker to download with
    // single connection, even target server accept range requests
    // Note: If both forceSingleConnection and forceMultipleConnections are true
    //       single connection will be used
    // default: false
    forceSingleConnection: false,

    // Number of miliseconds should wait for each progress calculation cycle
    // because it cost a little bit CPU to calculate the progress.
    // You should keep this updating cycle slow as posible, idle is 200ms
    // default: 200
    progressUpdateInterval: 200
};
```

## How to use (show me the code!)

### Simplest form, just download a file

In below example, Linode's server support Ranges request, so DownloadWorker will go with multiple connections.

```javascript
const {DownloadWorker} = require("./index");

const worker = new DownloadWorker("http://speedtest.tokyo2.linode.com/100MB-tokyo2.bin", "100MB-tokyo2.zip");
worker.on('ready', () => {
    worker.on('start', () => console.log('started'))
    worker.on('progress', (progress) => {
        console.log(`${progress.completedPercent}% - ${progress.bytesPerSecond} B/s`)
    });
    worker.on('finishing', () => console.log('Download is finishing'));
    worker.on('end', () => console.log('Download is done'));
    worker.start();
});

```

### Specify number of desired connections, display human-readable download speed

```javascript
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

```

### Force DownloadWorker to download by using single connection

```javascript
const {DownloadWorker, utils} = require("./index");

const worker = new DownloadWorker("http://speedtest.tokyo2.linode.com/100MB-tokyo2.bin", "100MB.zip", {
    forceSingleConnection: true
});
worker.on('ready', () => {
    worker.on('start', () => console.log('started'))
    worker.on('progress', (progress) => {
        const speed = utils.dynamicSpeedUnitDisplay(progress.bytesPerSecond, 2);
        console.log(`${progress.completedPercent}% - ${speed}`)
    });
    worker.on('finishing', () => console.log('Download is finishing'));
    worker.on('end', () => console.log('Download is done'));
    worker.on('error', error => console.log(error));
    worker.start();
});
```
