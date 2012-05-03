var async = require('async');
var Logger = require('bunyan');
var restify = require('restify');
var http = require('http');
var https = require('https');

var createUfdsModel = require('./models').createUfdsModel;
var createServer = require('./server').createServer;
var sysinfoToLdapServer = require('./models').sysinfoToLdapServer;
var Heartbeater = require('./heartbeater');
var Ur = require('./ur');

function CNAPI(config) {
    this.config = config;
    this.servers = {};
    this.log = new Logger({
        name: 'cnapi',
        level: config.logLevel,
        serializers: {
            err: Logger.stdSerializers.err,
            req: Logger.stdSerializers.req,
            res: restify.bunyan.serializers.response
        }
    });
}

CNAPI.prototype.start = function () {
    var self = this;

    http.globalAgent.maxSockets = self.config.maxHttpSockets || 100;
    https.globalAgent.maxSockets = self.config.maxHttpSockets || 100;

    var modelOptions = {
        amqp_use_system_config: false,
        ufds: self.config.ufds,
        amqp: self.config.amqp,
        wfapi: self.config.wfapi,
        datacenter: self.config.datacenter_name,
        log: self.log
    };

    self.log.info(self.modelOptions);

    var heartbeaterOptions = {
        host: self.config.amqp.host,
        log: self.log
    };

    var urOptions = {
        host: self.config.amqp.host,
        log: self.log
    };

    async.waterfall([
        function (callback) {
            self.initializeModel(modelOptions, callback);
        },
        function (callback) {
            var serverOptions = {
                model: self.model
            };
            self.initializeServer(serverOptions, callback);
        },
        function (callback) {
            self.initializeHeartbeater(heartbeaterOptions, callback);
        },
        function (callback) {
            self.initializeUr(urOptions, callback);
        }
    ],
    function (error) {
        self.server.listen(self.config.api.port, function () {
            self.log.info(
                '%s listening at %s',
                self.server.name,
                self.server.url);
        });
    });
};

CNAPI.prototype.initializeModel = function (options, callback) {
    var self = this;

    self.log.info('Initializing model and connecting to ufds');

    var model = self.model = createUfdsModel(options);
    model.connect(function (error) {
        if (error) {
            self.log.error(error, 'Error connecting to ufds');
            return callback(error);
        }
        self.log.debug('Model connected');
        return callback();
    });
};

CNAPI.prototype.initializeServer = function (options, callback) {
    this.server = createServer(options);
    return callback();
};

CNAPI.prototype.initializeHeartbeater = function (options, callback) {
    var self = this;

    var heartbeaterListener = new Heartbeater(options);
    heartbeaterListener.on('heartbeat', self.onHeartbeat.bind(self));
    heartbeaterListener.on('connectionError', function (err) {
        self.log.info('Connection error ' + err.message);
    });

    return callback();
};

CNAPI.prototype.initializeUr = function (options, callback) {
    var self = this;
    var ur = self.ur = new Ur(options);

    ur.connect(function () {
        ur.on('serverStartup', self.onServerStartup.bind(self));

        ur.on('connectionError', function (err) {
            self.log.info('Ur AMQP connection error');
        });
    });

    return callback();
};

CNAPI.prototype.refreshServerFromSysinfo = function (uuid, sysinfo, callback) {
    var self = this;

    if (self.servers[uuid]) {
        self.log.debug('Server %s found in local "cache"', uuid);
        return;
    }

    self.log.info('Server %s not found in cache, checking in ufds', uuid);

    self.model.listServers({ uuid: uuid }, function (list$error, servers) {
        if (list$error) {
            self.log.error(list$error, 'Error listing servers in ufds');
            callback(list$error);
            return;
        }

        if (servers.length > 0) {
            self.log.info(servers[0], '%s already in ufds', uuid);
            self.servers[uuid] = servers[0];
            callback(null, servers[0]);
            return;
        }

        sysinfo.datacenter = self.config.datacenter_name;

        self.model.createServerFromSysinfo(
            sysinfo,
            function (error, server) {
                if (error) {
                    self.log.info(error, 'Error creating server in ufds');
                    return;
                }
                self.log.debug('Cached server in memory');
                self.servers[uuid] = server;
            });
        return;
    });
};

CNAPI.prototype.updateServerMemory =
function (uuid, server, heartbeat, callback) {
    var self = this;
    var changes = [];

    self.log.info('%s already in UFDS', uuid);

    // Check if memory values have changed. Compile a list of
    // modifications if any have.
    var memoryKeys = [
        ['availrmem_bytes', 'memoryavailablebytes'],
        ['arcsize_bytes', 'memoryarcbytes'],
        ['total_bytes', 'memorytotalbytes'] ];

    memoryKeys.forEach(function (keys) {
        var hbVal = heartbeat.meminfo[keys[0]].toString();
        var serverVal = server[keys[1]] ? server[keys[1]].toString() : '';

        if (hbVal !== serverVal) {
            var change = {
                type: 'replace',
                modification: {}
            };

            change.modification[keys[1]] = hbVal.toString();
            changes.push(change);
        }
    });

    // If there are changes to be pushed to UFDS, do so then update the cache.
    if (changes.length) {
        // Attempt to modify memory values for server in UFDS, and if
        // that succeeds, cache those values too.
        self.log.debug(changes, 'UFDS changes');
        self.model.modifyServer(uuid, changes, function (modify$error) {
            if (modify$error) {
                self.log.error(
                    modify$error,
                    'Error modifying server record in UFDS');
                callback();
                return;
            }
            memoryKeys.forEach(function (keys) {
                var hbVal = heartbeat.meminfo[keys[0]].toString();
                server[keys[1]] = hbVal;
            });
            self.servers[uuid] = server;
        });
    } else {
        memoryKeys.forEach(function (keys) {
            var hbVal = heartbeat.meminfo[keys[0]].toString();
            server[keys[1]] = hbVal;
        });
        self.servers[uuid] = server;
        callback();
    }
};

CNAPI.prototype.refreshServerFromHeartbeat =
function (uuid, heartbeat, cb) {
    var self = this;

    if (self.servers[uuid]) {
        self.log.debug('Server %s found in local "cache"', uuid);

        self.updateServerMemory(
            uuid, self.servers[uuid], heartbeat, function () {
            callback();
            return;
        });
        return;
    }

    self.log.info('Server %s not found in cache, checking in ufds', uuid);

    self.model.listServers({ uuid: uuid }, function (list$error, servers) {
        if (list$error) {
            self.log.error(list$error, 'Error listing servers in ufds');
            callback(list$error);
            return;
        }

        // Check if there were matching servers in UFDS
        if (servers.length > 0) {
            self.updateServerMemory(
                uuid, servers[0], heartbeat, function (update$error) {
                callback();
                return;
            });
            return;
        } else {
            create();
            return;
        }
    });

    function callback(error) {
        if (cb) {
            cb(error);
            return;
        }
    }

    function create() {
        self.ur.serverSysinfo(uuid, function (error, sysinfo) {
            var server = sysinfoToLdapServer(sysinfo);

            server.memoryavailablebytes = heartbeat.meminfo.availrmem_bytes;
            server.memoryarcbytes = heartbeat.meminfo.arcsize_bytes;
            server.memorytotalbytes = heartbeat.meminfo.total_bytes;

            self.model.createUfdsServer(
                server,
                function (create$error, createdServer) {
                    if (create$error) {
                        self.log.info('Error creating server in ufds');
                        callback(create$error);
                        return;
                    }
                    self.servers[uuid] = server;
                    callback();
                    return;
                });
        });
    }
};

CNAPI.prototype.onServerStartup = function (message, routingKey) {
    var self = this;

    var uuid = routingKey.split('.')[2];
    self.log.info('Ur startup message received from %s', uuid);
    self.log.trace(message);

    self.refreshServerFromSysinfo(uuid, message);
};

CNAPI.prototype.onHeartbeat = function (heartbeat, routingKey) {
    var self = this;
    var uuid = routingKey.split('.')[1];
    self.log.debug('Heartbeat (%s) received -- %d zones.',
        uuid, heartbeat.zoneStatus[0].length);

    self.refreshServerFromHeartbeat(uuid, heartbeat, function (error, server) {
        if (error) {
            self.log.error(error, 'Error refreshing server\'s record in ufds');
            return;
        }
    });
};

module.exports = CNAPI;