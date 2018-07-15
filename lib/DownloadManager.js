const SimpleDownloadSession = require("./SimpleDownloadSession");

module.exports = class {
    constructor() {
        this.sessions = [];
    }

    addDownloadSession(url, saveToPath, options) {

    }

    addSimpleDownloadSession(url, saveToPath, options) {
        const session = new SimpleDownloadSession(url, saveToPath);
        this.sessions.push(session);
        return session;
    }
};