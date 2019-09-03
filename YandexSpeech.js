var net = Npm.require('net');
var uuid = Npm.require('node-uuid');
var bsplit = Npm.require('buffer-split');
var ProtoBuf = Npm.require("protobufjs");
var path = Npm.require('path');
var SoxCommand = require('sox-audio');
const {Transform} = require('stream');
const fs = require('fs');
const npmFibers = Npm.require('fibers');

var Protobuf = ProtoBuf.loadProtoFile({
    root: path.dirname(Assets.absoluteFilePath('private/voiceproxy.proto')),
    file: 'voiceproxy.proto'
}).build();

YandexSpeech = class YandexSpeech extends WrappedEventEmitter{
    constructor(options={}){
        super();
        this.options = options;
        var self = this;
        this.key = safeGet(options,'key','069b6659-984b-4c5f-880e-aaedcfd84102');
        this.topic = safeGet(options,'topic','freeform');
        this.bitrate = options.bitrate || '8000';
        this.STATE = {
            ended:false,
            inited: false,
            ready: false,
            _queue: 0,
            _lastChunkCb: function() {},
            queue: function(delta) {
                this._queue+=delta;
                if (this._queue === 0) {
                    this._lastChunkCb();
                }
            },
            waitForLastChunk: function(cb) {
                this._lastChunkCb = cb;
            }
        };

        this.client = new net.Socket();
        this.client.connect(80, 'voice-stream.voicetech.yandex.net', function() {
            self.client.setNoDelay(true);
            self.client.write([
                'GET /asr_partial HTTP/1.1\r\n',
                'User-Agent:KeepAliveClient\r\n',
                'Host: voice-stream.voicetech.yandex.net:80\r\n',
                'Upgrade: dictation\r\n\r\n',
            ].join(''));
        });

        this.incomingBuffer = new Buffer(0);
        this.client.on('data', function(data) {
            try {
                if (self.STATE.inited) {
                    if (self.STATE.ready) {
                        self.incomingBuffer = Buffer.concat([self.incomingBuffer, data]);
                        try {
                            while(true) {
                                var delim = new Buffer('\r\n');
                                var parts = bsplit(self.incomingBuffer, delim);

                                var len = parseInt(parts[0].toString(), 16);
                                var slice = self.incomingBuffer.slice(parts[0].length + 2, parts[0].length + 2 + len);
                                //console.log('len:', len, 'slice:', slice);
                                if (len == slice.length) {
                                    self.incomingBuffer = self.incomingBuffer.slice(parts[0].length + 2 + len,self.incomingBuffer.length);

                                    var response = Protobuf.VoiceProxyProtobuf.AddDataResponse.decode(slice);
                                    //console.dir(response);
                                    //console.log('response.messagesCount:',response.messagesCount);
                                    self.STATE.queue(-response.messagesCount);

                                    if (response.responseCode === 200 && response.recognition[0]) {
                                        //console.log(JSON.stringify(response));
                                        self.emit('recognize', response.recognition[0].normalized, response.endOfUtt,response);
                                        //console.log("\u001b[2J\u001b[0;0H" + response.recognition[0].normalized)
                                    }
                                    if(self.incomingBuffer.length==0){
                                        break;
                                    }
                                }else{
                                    break;
                                }
                            }
                            //console.log('response:',response);
                        } catch (e) {
                            //debugger;
                            var data = Protobuf.BasicProtobuf.ConnectionResponse.decode(parts[1]);
                            console.log(data);
                            console.error(e);
                            self.emit('error',e);
                            //console.error(data);
                            //console.log(data.toString('utf8'));
                        }
                    } else {
                        var delim = new Buffer('\r\n');
                        var parts = bsplit(data, delim);
                        Protobuf.BasicProtobuf.ConnectionResponse.decode(parts[1]);
                        self.STATE.ready = true;
                    }
                } else {
                    self.init(self.client);
                    self.STATE.inited = true;
                    setTimeout(()=>{
                        self.emit('init');
                    },30);

                }
            }catch(e){
                //debugger;
                console.log(e);
            }
        });

        this.client.on('close', function() {
            self.end();
        });

        this.client.on('error',function(err){
            console.log('this.client.on(\'error\'');
            console.error(err);
            this.emit('error',err);
            self.end();
        });

        if(options.log&&SoxCommand&&typeof MalibunFiles!=='undefined'){
            let logModel = {
                phone:safeGet(options,'phone',null),
                topic:this.topic,
                recognize:[],
                recognizedText:null,
                error:null,
                created:new Date(),
                malibun_file_id:null,
            };
            this.inputVoiceStream = new Transform({
                transform(chunk, encoding, callback) {
                    callback(null,chunk);
                }
            });
            this.once('error',(err)=>{
                logModel.error = String(err);
            });
            this.once('end',()=>{
                this.inputVoiceStream.end();
            });

            var futureFile = MalibunFiles.createNew(
                'wav',
                {
                    expires: new Date( Date.now()+7*24*3600*1000 ),
                    type:'recognition'
                },
                null,//userId
                null,//path
                `recognize${formatRuDateTime(new Date())}.wav`
            );

            this.on('recognize',(text,endOfUtt)=>{
                logModel.recognize.push({
                    text:text,endOfUtt:endOfUtt
                });
            });

            var onEnd = _.once(function(){
                npmFibers(function(){
                    futureFile.save().finally((err,file)=>{
                        logModel.malibun_file_id = safeGet(file,'_id',null);
                        logModel.recognizedText = _.map(logModel.recognize,(asrItem)=>{
                            return `${asrItem.text}`;
                        }).join('\n');
                        AsrLogs.insert(logModel);
                    });
                }).run();
            });

            var command = SoxCommand({captureStderr:true});
            command.input(this.inputVoiceStream)
                .inputEncoding('signed')
                .inputSampleRate(Number(this.bitrate))
                .inputBits(16)
                .inputChannels(1)
                .inputFileType('raw')
                .output( futureFile.path  )
                .outputBits(16)
                .outputSampleRate(Number(this.bitrate))
                .outputChannels(1)
                .outputFileType('wav');




            command.on('error', function(err, stdout, stderr) {
                onEnd();
            });
            command.on('end', function() {
                onEnd();
            });
            command.run();
        }

    }

    sendMessage(msg, socket) {
        var payload = msg.toBuffer();
        var buffer = Buffer.concat([
            new Buffer(payload.length.toString(16)),
            new Buffer('\r\n'),
            payload
        ]);
        return socket.write(buffer);
    }

    init(socket) {
        var self = this;
        var msg = new Protobuf.VoiceProxyProtobuf.ConnectionRequest({
            speechkitVersion:'',
            serviceName: 'asr_dictation',
            uuid: this.options.uuid || uuid.v4().replace(/-/g,''),
            apiKey: self.key,// '069b6659-984b-4c5f-880e-aaedcfd84102',
            applicationName: 'mintastest',
            device: 'desktop',
            coords: '0, 0',
            topic: self.topic,
            //topic:'queries',
            //topic:'general',
            //topic:'freeform',
            lang: 'ru-RU',
            format: `audio/x-pcm;bit=16;rate=${self.bitrate}`,

            punctuation: true,
             advancedASROptions: {
                 //biometry:'group,gender'
                 partial_results:true,
                  utterance_silence: 120,
                  cmn_latency: 150
             }

        });
        this.sendMessage(msg, socket);
    }

    initied(cb){
        if(this.STATE.inited){
            cb();
        }else{
            this.once('init',cb);
        }
    }

    send(chunk,lastChunk=false){
        var msg = new Protobuf.VoiceProxyProtobuf.AddData({
            audioData: chunk,
            lastChunk: lastChunk
        });
        this.STATE.queue(1);
        this.sendMessage(msg, this.client);
        if(this.inputVoiceStream){
            this.inputVoiceStream.write(chunk);
        }
    }

    end(){
        if(!this.STATE.ended) {
            this.STATE.ended = true;
            this.client.end();
            this.emit('end');
        }
    }



};



