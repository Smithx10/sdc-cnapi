/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2019, Joyent, Inc.
 */

var async = require('async');
var vasync = require('vasync');
var util = require('util');

var common = require('../../lib/common');
var mock = require('../lib/mock');
var nodeunit = require('nodeunit');
var sprintf = require('sprintf').sprintf;

var ModelServer = require('../../lib/models/server');

var uuids = [
    '372bdb58-f8dd-11e1-8038-0b6dbddc5e58',
    '6e8eb888-f8e0-11e1-b1a8-5f74056f9365',
    'b31695ce-f8e6-11e1-b252-fb742866284b'
];


function setup(callback) {
    callback();
}

function teardown(callback) {
    callback();
}

function testListServersAll(test) {
    test.expect(4);

    var expSearchResults = [
        { uuid: uuids[0], ram: '12345', sysinfo: { 'setup': true } },
        { uuid: uuids[1], ram: '56789', sysinfo: { 'setup': true } }
    ];

    var expSearchResults2 = [
        { server_uuid: uuids[0], last_heartbeat: (new Date()).toISOString() },
        { server_uuid: uuids[1], last_heartbeat: (new Date()).toISOString() }
    ];

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;

        moray.client.when('findObjects');
        moray.client.when('findObjects');

        ModelServer.init(app);

        var options = {};

        moray.client._findObjectsResults(expSearchResults);
        moray.client._findObjectsResults(expSearchResults2);

        ModelServer.list(options, function (listError, servers) {
            test.equal(listError, null, 'should not encounter an error');
            var expected =  [
                {
                    uuid: '372bdb58-f8dd-11e1-8038-0b6dbddc5e58',
                    ram: '12345',
                    sysinfo: { setup: true },
                    last_heartbeat: null,
                    status: 'unknown'
                },
                {
                    uuid: '6e8eb888-f8e0-11e1-b1a8-5f74056f9365',
                    ram: '56789',
                    sysinfo: { setup: true },
                    last_heartbeat: null,
                    status: 'unknown'
                }
            ];

            test.deepEqual(servers, expected, 'list results should match');
            test.deepEqual(
                moray.client.history[0],
                [
                    'findObjects',
                    'cnapi_servers',
                    '(&(uuid=*)!(uuid=default))',
                    { sort: { attribute: 'uuid', order: 'ASC' } }
                ],
                'moray history should match');
            test.done();
        });

    });
}

function testListServersByUuids(test) {
    test.expect(4);

    var expSearchResults = [
        { uuid: uuids[0], ram: '12345', sysinfo: { 'setup': true } },
        { uuid: uuids[2], ram: '56789', sysinfo: { 'setup': true } }
    ];

    var expSearchResults2 = [
        { server_uuid: uuids[0], last_heartbeat: (new Date()).toISOString() },
        { server_uuid: uuids[1], last_heartbeat: (new Date()).toISOString() }
    ];

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;
        moray.client.when('findObjects');

        moray.client._findObjectsResults(expSearchResults);
        moray.client._findObjectsResults(expSearchResults2);

        ModelServer.init(app);

        var options = {
            uuid: [uuids[0], uuids[2]]
        };

        ModelServer.list(options, function (listError, servers) {
            test.equal(listError, null, 'should not encounter an error');

            var expected =  [
                {
                    uuid: '372bdb58-f8dd-11e1-8038-0b6dbddc5e58',
                    ram: '12345',
                    sysinfo: { setup: true },
                    last_heartbeat: null,
                    status: 'unknown'
                },
                {
                    uuid: 'b31695ce-f8e6-11e1-b252-fb742866284b',
                    ram: '56789',
                    sysinfo: { setup: true },
                    last_heartbeat: null,
                    status: 'unknown'
                }
            ];

           test.deepEqual(
               servers,
               expected,
               'Server results should match');

            var filter
                = expSearchResults
                    .sort(function (a, b) {
                        return a.uuid > b.uuid;
                    })
                    .map(function (i) {
                        return sprintf('(uuid=%s)', i.uuid);
                    })
                    .join('');

            filter = sprintf('(&(|%s)!(uuid=default))', filter);

            test.deepEqual(
                moray.client.history[0],
                [
                    'findObjects',
                    'cnapi_servers',
                    filter,
                    { sort: { attribute: 'uuid', order: 'ASC' } }
                ],
                'moray history should match');


            test.done();
        });
    });
}

function testListServersSetup(test) {
    test.expect(4);

    var expSearchResults = [
        { uuid: uuids[0], ram: '12345', sysinfo: { 'setup': true } },
        { uuid: uuids[1], ram: '56789', sysinfo: { 'setup': true } }
    ];

    var expSearchResults2 = [
        { server_uuid: uuids[0], last_heartbeat: (new Date()).toISOString() },
        { server_uuid: uuids[1], last_heartbeat: (new Date()).toISOString() }
    ];

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;

        moray.client.when('findObjects');
        moray.client._findObjectsResults(expSearchResults);
        moray.client._findObjectsResults(expSearchResults2);

        ModelServer.init(app);

        var options = {
            setup: true
        };

        ModelServer.list(options, function (listError, servers) {
            test.equal(listError, null, 'should not encounter an error');

            var expected =  [
                {
                    uuid: '372bdb58-f8dd-11e1-8038-0b6dbddc5e58',
                    ram: '12345',
                    sysinfo: { setup: true },
                    last_heartbeat: null,
                    status: 'unknown'
                },
                {
                    uuid: '6e8eb888-f8e0-11e1-b1a8-5f74056f9365',
                    ram: '56789',
                    sysinfo: { setup: true },
                    last_heartbeat: null,
                    status: 'unknown'
                }
            ];

            test.deepEqual(servers, expected, 'list results should match');

            test.deepEqual(
                moray.client.history[0],
                [
                    'findObjects',
                    'cnapi_servers',
                    '(&(uuid=*)(&(setup=true)!(uuid=default)))',
                    { sort: { attribute: 'uuid', order: 'ASC' } }
                ],
                'moray history should match');
            test.done();
        });
    });
}

function testFetchServer(test) {
    test.expect(4);

    var expSearchResults = [
        { uuid: uuids[0], setup: true, sysinfo: { 'setup': true } }
    ];

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;
        moray.client.when('getObject', [], { value: expSearchResults[0] });

        ModelServer.init(app);

        var server = new ModelServer(uuids[0]);

        server.getRaw(function (getError, s) {
            test.equal(getError, null, 'should not encounter an error');
            test.deepEqual(s, expSearchResults[0], 'results should match');
            test.deepEqual(
                moray.client.history[0],
                [
                    'getObject',
                    'cnapi_servers',
                    uuids[0]
                ],
                'moray history should match');
            test.done();
        });
    });
}

function testCreateServer(test) {
    test.expect(3);

    var serverToAdd = { uuid: uuids[0], ram: '12345' };

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;
        moray.client.when('putObject', []);
        ModelServer.init(app);

        var server = new ModelServer(uuids[0]);
        server.setRaw(serverToAdd);
        server.store(serverToAdd, function (storeError) {
            test.equal(storeError, null, 'should not encounter an error');
            test.deepEqual(
                moray.client.history[0],
                [
                    'putObject',
                    'cnapi_servers',
                    uuids[0],
                    serverToAdd
                ],
            'moray command history');
            test.done();
        });
    });
}

function testDeleteServer(test) {
    test.expect(3);

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');
        var moray = components.moray;
        ModelServer.init(app);

        var server = new ModelServer(uuids[0]);

        server.del(function (delError) {
            test.equal(delError, null, 'should not encounter an error');

            test.deepEqual(
                moray.client.history[0],
                [
                    'delObject',
                    'cnapi_servers',
                    '372bdb58-f8dd-11e1-8038-0b6dbddc5e58'
                ],
            'moray command history');
            test.done();
        });
    });
}

function testRebootServer(test) {
    test.expect(2);

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;
        var workflow = components.workflow;

        var expSearchResults = [
            { uuid: uuids[0], setup: true, sysinfo: { 'setup': true } }
        ];

        moray.client.when('getObject', [], { value: expSearchResults[0] });

        moray.client.when('putObject', []);

        ModelServer.init(app);

        moray.client.when('findObjects');

        var server = new ModelServer(uuids[0]);

        server.reboot(function (err) {
            test.deepEqual(
                workflow.getClient().history,
                [
                    [
                        'createJob',
                        'server-reboot',
                        {
                            cnapi_url: 'http://10.99.99.18',
                            server_uuid: '372bdb58-f8dd-11e1-8038-0b6dbddc5e58',
                            target: '372bdb58-f8dd-11e1-8038-0b6dbddc5e58',
                            creator_uuid: undefined,
                            origin: undefined,
                            drain: false
                        }
                    ]
                ]);
            test.done();
        });
    });
}

function testModifyServer(test) {
    test.expect(3);

    var uuid = uuids[0];

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;
        moray.client.when('putObject', []);

        ModelServer.init(app);

        var server = new ModelServer(uuids[0]);

        var change = {
            uuid: uuid,
            setup: false
        };

        server.modify(change, function (modifyError) {
            test.deepEqual(
                moray.client.history[0],
                [
                    'putObject',
                    'cnapi_servers',
                    uuid,
                    change,
                    {}
                ],
            'moray command history');

            test.deepEqual(
                moray.client.history[0][3].setup,
                false,
                'boot platform should match');
            test.done();
        });
    });
}

function testModifyServerWithEtag(test) {
    test.expect(7);

    var uuid = uuids[0];
    var etag = 'etag-1234';

    mock.newApp(function (error, app, components) {
        test.equal(error, null, 'should not encounter an error');

        var moray = components.moray;
        moray.client.when('getObject', [], { _etag: etag });
        moray.client.when('putObject', []);

        ModelServer.init(app);

        var server = new ModelServer(uuids[0]);
        var change = {
            uuid: uuid,
            setup: false
        };

        vasync.pipeline({ funcs: [
            function doGetServer(_, next) {
                server.getRaw(function (err) {
                    test.ifError(err);
                    test.equal(server.etag, etag);
                    next();
                });
            },
            function doModifyServer(_, next) {
                server.modify(change, function (modifyError) {
                    test.ifError(modifyError);
                    next();
                });
            },
            function doCheck(_, next) {
                test.deepEqual(
                    moray.client.history[0],
                    [
                        'getObject',
                        'cnapi_servers',
                        uuid
                    ],
                    'moray command history');
                test.deepEqual(
                    moray.client.history[1],
                    [
                        'putObject',
                        'cnapi_servers',
                        uuid,
                        change,
                        { etag: etag }
                    ],
                    'moray command history');
                next();
            }
        ] },
        function (err) {
            test.done();
        });
    });
}

function testSetBootParameters(test) {
    test.expect(5);

    var uuid = uuids[0];

    var server;
    var moray;

    var newBootParameters = {
        simple: 'ronny',
        equal_quotes: 'sauce="apple"',
        commas: 'fee,fi,fo,fum',
        backslash: 'fruit\\cake'
    };

    var newKernelArgs = {
        '-k': true,
        '-m': 'milestone=none'
    };

    var expSearchResults = {
        uuid: uuid,
        boot_params: {},
        setup: true,
        boot_platform: '123Z',
        hostname: 'testbox',
        sysinfo: { 'setup': true },
        default_console: 'serial',
        serial: 'ttyb'
    };

    async.waterfall([
        function (callback) {
            mock.newApp(function (error, app, components) {
                moray = components.moray;

                test.equal(error, null, 'should not encounter an error');

                moray.client.when('putObject', []);
                moray.client.when('getObject', [], { value: expSearchResults });

                ModelServer.init(app);

                server = new ModelServer(uuid);
                callback();
            });
        },
        function (callback) {
            server.setBootParams(
                {
                    kernel_flags: newKernelArgs,
                    boot_params: newBootParameters,
                    boot_platform: 'newer',
                    default_console: 'vga',
                    serial: 'ttya'
                },
                function (modifyError) {
                    test.equal(
                        modifyError,
                        null);

                    test.deepEqual(
                        moray.client.history[1],
                        [
                            'putObject',
                            'cnapi_servers',
                            uuid,
                            {
                                uuid: uuid,
                                boot_params: newBootParameters,
                                setup: true,
                                boot_platform: 'newer',
                                boot_modules: [],
                                hostname: 'testbox',
                                sysinfo: { 'setup': true },
                                default_console: 'vga',
                                serial: 'ttya',
                                kernel_flags: {
                                    '-k': true,
                                    '-m': 'milestone=none'
                                }
                            },
                            {}
                        ],
                        'moray command history');
                        callback();
                });
        },
        function (callback) {
            expSearchResults = {
                uuid: uuid,
                boot_params: newBootParameters,
                setup: true,
                boot_platform: 'newer',
                hostname: 'testbox',
                sysinfo: { 'setup': true },
                default_console: 'serial',
                serial: 'ttyb',
                boot_modules: [],
                kernel_flags: {}
            };

            moray.client.when('getObject', [], { value: expSearchResults });
            delete server.value;

            server.getBootParams(function (getError, params) {
                test.equal(
                     getError,
                     null,
                     'Ensure no error returned');

                test.deepEqual(
                    params,
                    {
                        platform: 'newer',
                        kernel_args: {
                            rabbitmq: 'guest:guest:localhost:5672',
                            rabbitmq_dns: 'guest:guest:localhost:5672',

                            hostname: 'testbox',
                            simple: 'ronny',
                            equal_quotes: 'sauce="apple"',
                            commas: 'fee,fi,fo,fum',
                            backslash: 'fruit\\cake'
                        },
                        boot_modules: [],
                        kernel_flags: {},
                        default_console: 'serial',
                        serial: 'ttyb'
                    });

                callback();
            });
        }
    ],
    function () {
        test.done();
    });
}


function testUpdateBootParameters(test) {
    test.expect(5);

    var uuid = uuids[0];

    var server;
    var moray;

    var update = {
        updated: 'shazbot'
    };

    var updatedBootParams = {
        original: 'value',
        updated: 'shazbot'
    };

    var kernelArgs = {
        '-k': null,
        '-m': 'foo=bar',
        '-n': 'new'
    };

    var updatedKernelArgs = {
        '-m': 'foo=bar',
        '-n': 'new'
    };

    var expSearchResults = {
        uuid: uuid,
        boot_params: { 'original': 'value' },
        kernel_flags: { '-k': 'value', '-m': 'milestone=none' },
        setup: true,
        boot_platform: '123Z',
        boot_modules: [],
        hostname: 'testbox',
        sysinfo: { 'setup': true },
        default_console: 'serial',
        serial: 'ttyb'
    };

    async.waterfall([
        function (callback) {
            mock.newApp(function (error, app, components) {
                moray = components.moray;

                test.equal(error, null, 'should not encounter an error');

                moray.client.when('putObject', []);
                moray.client.when('getObject', [], { value: expSearchResults });
                moray.client.when('putObject', []);

                server = new ModelServer(uuid);
                callback();
            });
        },
        function (callback) {
            server.updateBootParams(
                {
                    kernel_flags: kernelArgs,
                    boot_params: update,
                    boot_modules: [ {}, {} ],
                    boot_platform: 'newer'
                },
                function (modifyError) {
                    test.equal(
                        modifyError,
                        null,
                        'There should be no error');

                    test.deepEqual(
                        moray.client.history[1],
                        [
                            'putObject',
                            'cnapi_servers',
                            uuid,
                            {
                                uuid: uuid,
                                boot_params: updatedBootParams,
                                kernel_flags: updatedKernelArgs,

                                setup: true,
                                boot_platform: 'newer',
                                boot_modules: [ {}, {} ],
                                hostname: 'testbox',
                                sysinfo: { 'setup': true },
                                default_console: 'serial',
                                serial: 'ttyb'
                            },
                            {}
                        ],
                        'moray command history');
                        callback();
                });
        },
        function (callback) {
            moray.client.when('getObject', [], { value: expSearchResults });
            delete server.value;

            expSearchResults = {
                uuid: uuid,
                boot_params: updatedBootParams,
                setup: true,
                boot_platform: 'newer',
                boot_modules: [ {}, {} ],
                hostname: 'testbox',
                sysinfo: { 'setup': true },
                default_console: 'serial',
                kernel_flags: updatedKernelArgs,
                serial: 'ttyb'
            };
            server.getBootParams(function (getError, params) {
                test.equal(
                     getError,
                     null,
                'There should be no error');

                test.deepEqual(
                    params,
                    {
                        platform: 'newer',
                        kernel_args: {
                            rabbitmq: 'guest:guest:localhost:5672',
                            rabbitmq_dns: 'guest:guest:localhost:5672',
                            hostname: 'testbox',
                            original: 'value',
                            updated: 'shazbot'
                        },
                        kernel_flags: updatedKernelArgs,
                        default_console: 'serial',
                        boot_modules: [ {}, {} ],
                        serial: 'ttyb'
                    });

                callback();
            });
        }
    ],
    function () {
        test.done();
    });
}

module.exports = nodeunit.testCase({
    setUp: setup,
    tearDown: teardown,
    'list all servers':                       testListServersAll,
    'list multiple servers by uuid':          testListServersByUuids,
    'list servers which are marked as setup': testListServersSetup,
    'fetch a particular server':              testFetchServer,
    'create server':                          testCreateServer,
    'delete a server':                        testDeleteServer,
    'reboot server':                          testRebootServer,
    'modify server':                          testModifyServer,
    'modify server with etag':                testModifyServerWithEtag,
    'set server boot parameters':             testSetBootParameters,
    'update server boot parameters':          testUpdateBootParameters
});
