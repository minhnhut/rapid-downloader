const http = require("http")
const https = require("https")
const fs = require("fs")
const url = require("url")
const AbstractDownloadSession = require("./AbstractDownloadSession");

module.exports = class extends AbstractDownloadSession {

    /***
     * @param {Object} options {
     *          {string} downloadUrl: File URL to be downloaded (HTTPS or HTTP),
     *          {bool}   isPartial: is it partial. If true, fromBytes and toBytes are required
     *          {string} savePath: system path to place that target file will be saved,
     *          {int}    fromBytes: Byte offset to begin download. Only available when isPartial=true.
     *          {int}    toBytes: Byte offset to download until. Only available when isPartial=true.
     *        }
     */
    constructor(options) {

        // Validations
        if (typeof options !== "object")
            throw new Error("Expected options to be an object");
        if (!options.downloadUrl)
            throw new Error("downloadUrl is required parameter to intilize a Download Session");
        if (!options.savePath)
            throw new Error("savePath is required parameter to intilize a Download Session");
        if (!options.isPartial)
            options.isPartial = true;
        if (options.isPartial) {
            if (typeof options.fromBytes !== "number" || typeof options.toBytes !== "number")
                throw new Error("isPartial is set to true. But didn't provide a valid fromBytes and toBytes range");
            if (options.toBytes <= options.fromBytes)
                throw new Error("invalid fromBytes and toBytes range: " + options.fromBytes + "~" + options.toBytes);
        }

        super(options.downloadUrl, options.savePath);
        this.isPartial = options.isPartial;
        this.fromBytes = options.fromBytes;
        this.toBytes = options.toBytes;
        // this.totalBytes = this.toBytes - this.fromBytes + 1; // inclusive
        // this.temporaryPath = "";
    }

    /**
     * Will be called by super class
     * @param {string} downloadUrl 
     * @param {string} toFile 
     */
    _downloadFile(downloadUrl, toFile) {
        const file = fs.createWriteStream(this.savePath);
        const requestOptions = url.parse(downloadUrl);
        requestOptions.headers = {};
        if (this.isPartial) {
            requestOptions.headers["Range"] = `bytes=${this.fromBytes}-${this.toBytes}`;
        }
        requestOptions.timeout = 3000;
        const httpLibrary = requestOptions.protocol.indexOf("https") === 0 ? https : http;
        httpLibrary.get(requestOptions, res => {
            this.lastSecondDownloadedBytes = 0;
            this.downloadedBytes = 0;
            this.bytesPerSecond = 0;
            res.pipe(file);
            this._handleResponse(res);
        }).on('error', e => this._emitError(e));
        this.status = "downloading";
    };
};