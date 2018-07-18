const SimpleDownloadSession = require("./SimpleDownloadSession")
const PartialDownloadSession = require("./PartialDownloadSession")
const EventEmitter = require("events")
const fjs          = require("functional.js")
const http         = require("http")
const https        = require("https")
const url          = require("url")
const Utils        = require('./Utils')

module.exports = class extends EventEmitter {
    constructor(downloadUrl, saveToPath, options) {
        super();
        this.sessions = [];
        this.totalBytes = 0;
        this.downloadedBytes = 0;
        this.completedPercent = 0;
        this.url = downloadUrl;
        this.saveToPath = saveToPath;
        this.options = options;
        this.isPartialSupported = false;
        this.completedConnections = 0;

        const defaultTo = fjs.curry((d, x) => x ? x : d);
        options = defaultTo({}, options);
        // option.maxConnections
        this.maxConnections = defaultTo(4, options.maxConnections);
        // option.forceMultipleConnections
        this.forceMultipleConnections = defaultTo(false, options.forceMultipleConnections);

        // option.forceSingleConnection
        this.forceSingleConnection = defaultTo(false, options.forceSingleConnection);

        const requestOptions = url.parse(downloadUrl);
        requestOptions.method = "HEAD";
        const httpLibrary = requestOptions.protocol === "https" ? https : http;
        const request = httpLibrary.request(requestOptions, res => {
            this.totalBytes = res.headers["content-length"];
            if (res.headers["accept-ranges"] && res.headers["accept-ranges"] == "bytes") {
                this.isPartialSupported = true;
            }
            this.emit('ready');
        });
        request.end();
    }

    start() {
        if ( (this.isPartialSupported || this.forceMultipleConnections) && !this.forceSingleConnection)  {
            this.addPartialDownloadSession(this.url, this.saveToPath, this.maxConnections);
        } else {
            this.addSimpleDownloadSession(this.url, this.saveToPath)
        }
    }

    addSimpleDownloadSession(url, saveToPath, options) {
        const session = new SimpleDownloadSession(url, saveToPath);
        this._pushToSessions(session);
    }

    addPartialDownloadSession(url, saveToPath, numberOfConnections) {
        const ideaBytesPerConnection = Math.floor(this.totalBytes / numberOfConnections); // 300
        // 401
        // 2
        let totalBytes = this.totalBytes;
        let lastByte = 0;
        let ranges = [];
        while (totalBytes > 0) {
            // l 0
            // 200
            // 0 - 199
            // t 201
            // l 200
            // 200
            // 200 - 399
            // t 1
            // 400 - 400
            const downloadableBytes = totalBytes > ideaBytesPerConnection ? ideaBytesPerConnection : totalBytes;
            const toByte = lastByte + downloadableBytes - 1;
            ranges.push([lastByte, toByte]);
            totalBytes -= downloadableBytes;
            lastByte = toByte + 1;
        };

        const createPartialSessionAndPush = R.curry((url, saveToPath, range, index) => {
            const session = new PartialDownloadSession(url, saveToPath, range[0], range[1], index);
            this._pushToSessions(session);
        })
        const createPartialSessionFromRangeAndPush = createPartialSessionAndPush(url, saveToPath);
        // console.log(ranges);
        ranges.forEach( (range, index) =>  createPartialSessionFromRangeAndPush(range, index));
        // R.forEach(createPartialSessionFromRangeAndPush, ranges);
    }

    /**
     * 
     * @param {AbstractDownloadSession} session 
     * @param {Object} progress 
     */
    _onProgress(session, progress) {
        this._refreshProgress();
        this.emit('progress', {
            totalBytes: this.totalBytes,
            downloadedBytes: this.downloadedBytes,
            percent: this.completedPercent,
            bytesPerSecond: this.bytesPerSecond
        });
    }

    _refreshProgress() {
        const reduceBySum = (propName, list) => R.reduce((a,c) => R.add(a, R.prop(propName, c)), 0, list)
        this.downloadedBytes = reduceBySum('downloadedBytes', this.sessions);
        this.completedPercent = Utils.calculateCompletedPercent(this.downloadedBytes, this.totalBytes);
        this.bytesPerSecond = reduceBySum('bytesPerSecond', this.sessions);
    }

    _onEnd(session) {
        this.completedConnections++;
        if (this.sessions.length > 1) {
            if (this.completedConnections == this.sessions.length) {
                const getFilePaths = R.map(x => x.temporaryPath);
                this.emit("finishing");
                Utils.joinFiles(getFilePaths(this.sessions), this.saveToPath, () => {
                    this.emit('end');
                })
            }
        } else {
            this.emit('end');
        }
    }

    /**
     * Add download session into pool
     * @param {AbstractDownloadSession} session 
     */
    _pushToSessions(session) {
        session.id = this.sessions.length;
        session.on('progress', progress => this._onProgress(session, progress));
        session.on('end', () => this._onEnd(session))
        session.start();
        this.sessions.push(session);
    }
};