Package.describe({
    name: 'malibun23:yandexspeechkit',
    version: '0.0.2',
    summary: '',
    git: '',
    documentation: 'README.md'
});

Npm.depends({
    "node-uuid":"1.4.2",
    "buffer-split":"1.0.0",
    "protobufjs":"5.0.1",
    "safetydance":"0.1.1",
    "path":"0.11.14"
});

Package.onUse(function(api) {
    api.versionsFrom('1.2.1');
    api.use('ecmascript');
    api.use('underscore');
    api.use('momentjs:moment');
    api.use('mrt:moment-timezone');
    api.use('rzymek:moment-locale-ru');
    api.use('raix:eventemitter');
    api.use('stevezhu:lodash@4.13.1');
    api.use('raix:eventemitter');
    api.use('malibun23:stack','server');

    api.addFiles(['lib.js'],['server']);
    api.addAssets(['private/voiceproxy.proto','private/basic.proto'],'server');
    api.export(['YandexSpeech'],['server']);
});

Package.onTest(function(api) {
    api.use('ecmascript');
    api.use('tinytest');
});
