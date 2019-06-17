const SimpleDownloadSession = require("./SimpleDownloadSession")
const PartialDownloadSession = require("./PartialDownloadSession")
const DownloadSession = require("./DownloadSession")
const EventEmitter = require("events")
const fjs          = require("functional.js")
const http         = require("http")
const https        = require("https")
const url          = require("url")
const Utils        = require('./Utils')
const path         = require("path")


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
        this.paused = false;
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
        // option.maxRetryTimes
        this.maxRetryTimes = defaultTo(5, options.maxRetryTimes);
        this.progressUpdateTimer = null;
        this.state = "idle"; // [idle, downloading, finshing, paused, end]
        const requestOptions = url.parse(downloadUrl);
        requestOptions.method = "HEAD";
        const httpLibrary = requestOptions.protocol.indexOf("https") === 0 ? https : http;
        const request = httpLibrary.request(requestOptions, (res) => {
            this.totalBytes = res.headers["content-length"];
            this.isPartialSupported = res.headers["accept-ranges"] && res.headers["accept-ranges"] == "bytes";
            console.log(res.headers["accept-ranges"])
            if (res.statusCode == 200) {
                this.emit('ready');
            } else {
                this.emit("error", {"code": "ERROR_BAD_STATUS_CODE", "message": "Target is not downloadable, server didn't response with 200 code."});
            }
        });
        request.on('error', err => this.emit("error", {"code": "ERROR_CONNECT_TO_SERVER", "message": "Can not connect to target server."}));
        request.end();
    }

    start() {
        if (this.state !== "idle") return this.emit('error', {"code": "INVALID_STATE", "message": "Worker is in invalid state. Can not be started"});
        const shouldUseMultipleConnections = (this.isPartialSupported || this.forceMultipleConnections) && !this.forceSingleConnection;
        const sessions = shouldUseMultipleConnections ? this.makePartialSessions(this.url, this.saveToPath, this.maxConnections)
            : [this.makeSimpleSession(this.url, this.saveToPath)];
        fjs.each(s => this._pushToSessions(s), sessions);
        this.state = "downloading";
    }

    resume() {
        this.paused = false;
        this.sessions.forEach(s => s.resume());
    }

    pause() {
        this.paused = true;
        this.sessions.forEach(s => s.pause());
    }

    stop() {
        this.emit('stop');
        this.state = 'stop';
        this._stopProgressUpdateInterval();
        this.sessions.forEach(s => s.stop());
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
            const isPartial = range[1]-range[0] < this.totalBytes;
            const filename = path.basename(saveToPath);
            const savePath = path.resolve(process.cwd(), filename);
            const temporaryPath = savePath + "." + index; 

            sessions.push(new DownloadSession({
                downloadUrl: url,
                savePath: temporaryPath,
                isPartial: isPartial,
                fromBytes: range[0],
                toBytes: range[1]
            }));
        })
        const createPartialSessionFromRange = createPartialSession(url, saveToPath);
        fjs.each(createPartialSessionFromRange, ranges);
        return sessions;
    }

    getProgress() {
        return {
            totalBytes: this.totalBytes,
            downloadedBytes: this.downloadedBytes,
            completedPercent: this.completedPercent,
            bytesPerSecond: this.bytesPerSecond,
            state: this.state
        };
    }

    /**
     * Internal function to refresh download progress
     */
    _onProgress() {
        this._refreshProgress();
        this.emit('progress', this.getProgress());
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
        console.log(error);
        if (this.maxRetryTimes > 0) {
            session.stop();
            session.start();
            this.maxRetryTimes--;
        } else {
            this.emit("error", {"code": "CONNECTION_BROKEN", "message": "One of download sessions has failed. Maybe there was network interuption."});
            this.stop();
        }
    }

    _onEnd(session) {
        const setState = (state) => {
            this.emit(state);
            this.state = state;
            this._stopProgressUpdateInterval();
        }
        this.completedConnections++;
        if (this.completedConnections == this.sessions.length) {
            const getFilePaths = fjs.map(x => x.savePath);
            setState("finishing");
            Utils.joinFiles(getFilePaths(this.sessions), this.saveToPath, () => {
                setState("end");
            })
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