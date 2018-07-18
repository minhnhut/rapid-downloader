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
        const defaultTo = (d, x) => x ? x : d;
        options = defaultTo({}, options);
        // option.maxConnections
        this.maxConnections = defaultTo(4, options.maxConnections);
        // option.forceMultipleConnections
        this.forceMultipleConnections = defaultTo(false, options.forceMultipleConnections);
        // option.forceSingleConnection
        this.forceSingleConnection = defaultTo(false, options.forceSingleConnection);
        // option.progressUpdateInterval
        this.progressUpdateInterval = defaultTo(200, options.progressUpdateInterval);
        this.progressUpdateTimer = null;
        this.state = "idle"; // [idle, downloading, finshing, paused, end]
        const requestOptions = url.parse(downloadUrl);
        requestOptions.method = "HEAD";
        const httpLibrary = requestOptions.protocol === "https" ? https : http;
        const request = httpLibrary.request(requestOptions, res => {
            this.totalBytes = res.headers["content-length"];
            this.isPartialSupported = res.headers["accept-ranges"] && res.headers["accept-ranges"] == "bytes";
            this.emit('ready');
        });
        request.end();
    }

    start() {
        const shouldUseMultipleConnections = (this.isPartialSupported || this.forceMultipleConnections) && !this.forceSingleConnection;
        const sessions = shouldUseMultipleConnections ? [this.makeSimpleSession(this.url, this.saveToPath, this.maxConnections)]
            : this.makePartialSessions(this.url, this.saveToPath);
        fjs.each(s => this._pushToSessions(s), sessions);
        this.state = "downloading";
    }

    makeSimpleSession(url, saveToPath) {
        return new SimpleDownloadSession(url, saveToPath);
    }

    makePartialSessions(url, saveToPath, numberOfConnections) {
        const ideaBytesPerConnection = Math.floor(this.totalBytes / numberOfConnections);
        let totalBytes = this.totalBytes;
        let lastByte = 0;
        let ranges = [];
        while (totalBytes > 0) {
            const downloadableBytes = totalBytes > ideaBytesPerConnection ? ideaBytesPerConnection : totalBytes;
            const toByte = lastByte + downloadableBytes - 1;
            ranges.push([lastByte, toByte]);
            totalBytes -= downloadableBytes;
            lastByte = toByte + 1;
        };
        let sessions = [];
        const createPartialSession = fjs.curry((url, saveToPath, range, index) => {
            sessions.push(new PartialDownloadSession(url, saveToPath, range[0], range[1], index));
        })
        const createPartialSessionFromRange = createPartialSession(url, saveToPath);
        fjs.each(createPartialSessionFromRange, ranges);
        return sessions;
    }

    /**
     * 
     * @param {AbstractDownloadSession} session 
     * @param {Object} progress 
     */
    _onProgress() {
        this._refreshProgress();
        this.emit('progress', {
            totalBytes: this.totalBytes,
            downloadedBytes: this.downloadedBytes,
            completedPercent: this.completedPercent,
            bytesPerSecond: this.bytesPerSecond
        });
    }

    /**
     * Recalculate progress aross sessions. Cause it cost CPU cycles, should be called less often as possible.
     */
    _refreshProgress() {
        const sumAll = fjs.reduce((a,x) => a + x);
        const getPropAsArray = (propName, objectList) => fjs.map(fjs.prop(propName), objectList);
        const reduceBySum = fjs.compose(sumAll, getPropAsArray);

        this.downloadedBytes = reduceBySum('downloadedBytes', this.sessions);
        this.completedPercent = Utils.calculateCompletedPercent(this.downloadedBytes, this.totalBytes);
        this.bytesPerSecond = reduceBySum('bytesPerSecond', this.sessions);
    }

    _onError(session, error) {
        this.emit("error", error);
    }

    _onEnd(session) {
        const setState = (state) => {
            this.emit(state);
            this.state = state;
            this._stopProgressUpdateInterval();
        }
        this.completedConnections++;
        if (this.sessions.length > 1) {
            if (this.completedConnections == this.sessions.length) {
                const getFilePaths = fjs.map(x => x.temporaryPath);
                setState("finishing");
                Utils.joinFiles(getFilePaths(this.sessions), this.saveToPath, () => {
                    setState("end");
                })
            }
        } else {
            setState("finishing");
            setState("end");
        }
    }

    /**
     * Add download session into pool
     * @param {AbstractDownloadSession} session 
     */
    _pushToSessions(session) {
        session.id = this.sessions.length;
        if (this.progressUpdateInterval > 0) {
            // delay update progress, by run an interval (configurable by constructor's options)
            this._beginProgressUpdateInterval();
        } else {
            // update progress a soon as information is ready
            session.on('progress', () => this._onProgress());
        }
        session.on('end', () => this._onEnd(session));
        session.on('error', (error) => this._onError(session, error));
        session.start();
        this.sessions.push(session);
    }

    _beginProgressUpdateInterval() {
        if (!this.progressUpdateTimer) this.progressUpdateTimer = setInterval(() => this._onProgress(), this.progressUpdateInterval);
    }

    _stopProgressUpdateInterval() {
        if (this.progressUpdateTimer) clearInterval(this.progressUpdateTimer);
    }
};