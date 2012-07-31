/*
 * Copyright (c) 2012, Joyent, Inc. All rights reserved.
 *
 * This is the workflow responsible for setting up a compute node.
 *
 * - CNAPI receives setup HTTP request
 * - CNAPI starts workflow
 * - Workflow sends node.config to compute node
 * - Workflow sends joysetup.sh to compute node
 * - Workflow sends agentsetup.sh to compute
 * - Workflow creates an Ur script which fetches and runs joysetupper
 * - Set server setup => true
 */

var VERSION = '1.0.0';

var sdcClients = require('sdc-clients');
var uuid = require('node-uuid');
var restify = require('restify');


function validateParams(job, callback) {
    console.log(job.params);

    if (!job.params.server_uuid) {
        callback(new Error('Must specify server_uuid'));
        return;
    }

    if (!job.params.cnapi_url) {
        callback(new Error('Must specify cnapi_url'));
        return;
    }

    if (!job.params.assets_url) {
        callback(new Error('Must specify assets_url'));
        return;
    }

    callback(null, 'All parameters OK!');
}

function fetchSetupFiles(job, callback) {
    var urUrl = '/ur/' + job.params.server_uuid;
    var cnapiUrl = job.params.cnapi_url;
    var assetsUrl = job.params.assets_url;
    var cnapi = restify.createJsonClient({ url: cnapiUrl});

    var script = [
        '#!/bin/bash',
        'set -o xtrace',
        'cd /var/tmp',
        'mkdir /var/tmp/node.config',
        'curl -o node.config/node.config $1/extra/joysetup/node.config',
        'curl -O $1/extra/joysetup/joysetup.sh',
        'curl -O $1/extra/joysetup/agentsetup.sh',
        'chmod +x *.sh'
    ].join('\n');

    var payload = {
        script: script,
        args: [assetsUrl]
    };

    cnapi.post(urUrl, payload, function (error, req, res) {
        if (error) {
            console.error('Error posting to Ur via CNAPI');
            callback(error);
            return;
        }
        callback();
    });
}

function executeJoysetupScript(job, callback) {
    var urUrl = '/ur/' + job.params.server_uuid;
    var cnapiUrl = job.params.cnapi_url;
    var cnapi = restify.createJsonClient({ url: cnapiUrl});

    var script = [
        '#!/bin/bash',
        'set -o xtrace',
        'cd /var/tmp',
        './joysetup.sh'
    ].join('\n');

    var payload = {
        script: script
    };

    cnapi.post(urUrl, payload, function (error, req, res) {
        if (error) {
            console.error('Error posting to Ur via CNAPI');
            callback(error);
            return;
        }
        callback();
    });
}

function executeAgentSetupScript(job, callback) {
    var urUrl = '/ur/' + job.params.server_uuid;
    var cnapiUrl = job.params.cnapi_url;
    var assetsUrl = job.params.assets_url;
    var cnapi = restify.createJsonClient({ url: cnapiUrl});

    var script = [
        '#!/bin/bash',
        'set -o xtrace',
        'cd /var/tmp',
        'echo ASSETS_URL = $ASSETS_URL',
        './agentsetup.sh'
    ].join('\n');

    var payload = {
        script: script,
        env: { ASSETS_URL: assetsUrl }
    };

    cnapi.post(urUrl, payload, function (error, req, res) {
        if (error) {
            console.error('Error posting to Ur via CNAPI');
            callback(error);
            return;
        }
        callback();
    });
}

function markServerAsSetup(job, callback) {
    var cnapiUrl = job.params.cnapi_url;
    var cnapi = restify.createJsonClient({ url: cnapiUrl});
    var serverUrl = '/servers/' + job.params.server_uuid;

    var payload = {
        setup: 'true'
    };

    cnapi.post(serverUrl, payload, function (error, req, res) {
        if (error) {
            console.error('Error posting to Ur via CNAPI');
            callback(error);
            return;
        }
        callback();
    });
}

module.exports = {
    name: 'server-setup-' + VERSION,
    version: VERSION,
    onerror: [
        {
            name: 'onerror',
            body: function (job, cb) {
                cb(new Error('Error executing job'));
            }
        }
    ],

    chain: [
        {
            name: 'cnapi.validate_params',
            timeout: 10,
            retry: 1,
            body: validateParams
        },
        {
            name: 'cnapi.fetch_setup_files',
            timeout: 10,
            retry: 1,
            body: fetchSetupFiles
        },
        {
            name: 'cnapi.execute_joysetup_script',
            timeout: 1000,
            retry: 1,
            body: executeJoysetupScript
        },
        {
            name: 'cnapi.execute_agentsetup_script',
            timeout: 1000,
            retry: 1,
            body: executeAgentSetupScript
        },
        {
            name: 'cnapi.mark_server_as_setup',
            timeout: 1000,
            retry: 1,
            body: markServerAsSetup
        }
//         {}
    ]
};