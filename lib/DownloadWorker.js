const DownloadSession = require("./DownloadSession")
const EventEmitter = require("events")
const fjs          = require("functional.js")
const http         = require("http")
const https        = require("https")
const url          = require("url")
const Utils        = require('./Utils')
const path         = require("path")
const { finished } = require('stream')

const RANGE_SPLIT_STRATEGY_FIXED    = "fixed";
const RANGE_SPLIT_STRATEGY_ADAPTIVE = "adapt";

module.exports = class extends EventEmitter {
    constructor(downloadUrl, saveToPath, options) {
        super();
        this.sessions = [];
        this.activeSessions = [];
        this.ranges = [];
        this.completedConnections = 0;
        this.totalBytes = 0;
        this.downloadedBytes = 0;
        this.completedPercent = 0;
        this.url = downloadUrl;
        this.saveToPath = saveToPath;
        this.options = options;
        this.isPartialSupported = false;
        this.paused = false;
        this.lastProgressUpdateTime = Date.now();
        this.lastProgressUpdateBytes = 0;
        const defaultTo = (d, x) => x ? x : d;
        options = defaultTo({}, options);
        // options.rangeSplitStrategy
        this.rangeSplitStrategy = RANGE_SPLIT_STRATEGY_ADAPTIVE;
        // options.bytesPerConnection
        this.bytesPerConnection = defaultTo(104857600, options.bytesPerConnection); // Default: 100MB per connection
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
            if (res.statusCode == 200) {
                this.emit('ready', {
                    totalBytes: this.totalBytes,
                });
            } else {
                this.emit("error", {"code": "ERROR_BAD_STATUS_CODE", "message": "Target is not downloadable, server didn't response with 200 code."});
            }
        });
        finished(request, e => 
            e && this.emit("error", {
                "code": "ERROR_CONNECT_TO_SERVER",
                "message": "Can not connect to target server."
            })
        );
        request.end();
    }

    start() {
        if (this.state !== "idle") return this.emit('error', {"code": "INVALID_STATE", "message": "Worker is in invalid state. Can not be started"});
        const shouldUseMultipleConnections = (this.isPartialSupported || this.forceMultipleConnections) && !this.forceSingleConnection;
        if (shouldUseMultipleConnections) {
            // divide to multi ranges
            let goodSizePerConnection = this.bytesPerConnection;
            if (this.rangeSplitStrategy === RANGE_SPLIT_STRATEGY_ADAPTIVE) {
                // if totalBytes divided for maxConnections yield lower value than bytePerConnection
                // let use that value instead, it is more effective to use all allowed connections.
                let bytesPerConnectionMax = Math.round(this.totalBytes / this.maxConnections);
                if (bytesPerConnectionMax < goodSizePerConnection) {
                    goodSizePerConnection = bytesPerConnectionMax;
                }
            }
            this.ranges = Utils.splitRanges(this.totalBytes, goodSizePerConnection);
            // this.ranges = ranges.map(v => v.join(',')); // serialize range to store in array
        } else {
            // one range
            this.ranges = [[0,this.totalBytes-1]];
        }
        // make some first sessions
        this.makeDownloadSessions();
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

    makeDownloadSessions() {
        const url = this.url;
        const saveToPath = this.saveToPath;
        const createSession = fjs.curry((url, saveToPath, range, index) => {

            const isPartial = range[1]-range[0] < this.totalBytes;
            const filename = path.basename(saveToPath);
            const savePath = path.resolve(process.cwd(), filename);
            const temporaryPath = savePath + "." + index; 

            return new DownloadSession({
                downloadUrl: url,
                savePath: temporaryPath,
                isPartial: isPartial,
                fromBytes: range[0],
                toBytes: range[1]
            });
        })
        const createPartialSessionFromRange = createSession(url, saveToPath);
        while (this.activeSessions.length < this.maxConnections && this.ranges.length > 0) {
            const range = this.ranges.shift();  // this will take a range of ranges (mutable)
            const index = this.sessions.length;
            const session = createPartialSessionFromRange(range, index);
            this._pushToSessions(session);
        }
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

        // Downloaded bytes progress updating
        // old progress
        const lastDownloadedBytes = this.downloadedBytes;
        // new progress
        this.downloadedBytes = reduceBySum('downloadedBytes', this.sessions);

        // Downloaded percent progress updating
        this.completedPercent = Utils.calculateCompletedPercent(this.downloadedBytes, this.totalBytes);

        // BytePerSecond progress updating
        const diffWithNow = (milis) => Date.now() - milis;
        const milisToSeconds = fjs.compose(
            x => x/1000,
            parseFloat
        );
        const diffWithLastProgressUpdateTime = diffWithNow(this.lastProgressUpdateTime);
        this.lastProgressUpdateBytes += this.downloadedBytes - lastDownloadedBytes
        if (diffWithLastProgressUpdateTime > 1000) {
            this.bytesPerSecond = Math.floor(this.lastProgressUpdateBytes / milisToSeconds(diffWithLastProgressUpdateTime));
            this.lastProgressUpdateBytes = 0;
            this.lastProgressUpdateTime = Date.now();
        }
    }

    _onError(session, error) {
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
            this.state = state;
            this.emit(state);
            this._stopProgressUpdateInterval();
        }
        this.activeSessions.splice(this.activeSessions.indexOf(session), 1);
        this.completedConnections++;
        // check if there is still pending range, or active sessions
        if (this.ranges.length === 0) {
            if (this.activeSessions.length === 0) {
                const getFilePaths = fjs.map(x => x.savePath);
                setState("finishing");
                Utils.joinFiles(getFilePaths(this.sessions), this.saveToPath, () => {
                    setState("end");
                })
            }
        } else {
            // make more sessions
            this.makeDownloadSessions();
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
        this.activeSessions.push(session);
    }

    _beginProgressUpdateInterval() {
        if (!this.progressUpdateTimer) this.progressUpdateTimer = setInterval(() => this._onProgress(), this.progressUpdateInterval);
    }

    _stopProgressUpdateInterval() {
        if (this.progressUpdateTimer) clearInterval(this.progressUpdateTimer);
    }
};