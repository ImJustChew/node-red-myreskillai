module.exports = function (RED) {
  'use strict';
  // var io = require('socket.io-client');
  var sockets = {};

  /* sckt connector*/
  function ReskillAIConnector(n) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    var node = this;

    if (sockets[node.id]) { delete sockets[node.id]; }
    sockets[node.id] = connect();

    sockets[node.id].on('connect', function () {
      sockets[node.id].emit('user', 'node-red')
      node.send({ socketId: node.id, payload: { socketId: node.id, status: 'connected' } });
      node.status({ fill: "green", shape: "dot", text: "connected" });
    });

    sockets[node.id].on('disconnect', function () {
      node.send({ socketId: node.id, payload: { socketId: node.id, status: 'disconnected' } });
      node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
    });

    sockets[node.id].on('connect_error', function (err) {
      if (err) {
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
        node.send({ socketId: node.id, payload: { socketId: node.id, status: 'disconnected' } });
        //node.error(err);
      }
    });

    this.on('close', function (done) {
      sockets[node.id].disconnect();
      node.status({});
      done();
    });
  }
  RED.nodes.registerType('reskilai-connector', ReskillAIConnector);

  function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return binary;
  }

  /* inference listener*/
  function InferenceListener(n) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    this.socketId = null;
    var node = this;
    node.on('input', function (msg) {
      node.socketId = msg.socketId;
      if (msg.payload.status == 'connected') {
        node.status({ fill: 'green', shape: 'dot', text: 'listening' });
        if (!sockets[node.socketId].hasListeners('inference')) {
          sockets[node.socketId].on('inference', function ({ image, data }) {
            node.send([
              { payload: "data:image/png;base64," + arrayBufferToBase64(image) },
              { payload: data }
            ]);
          });
        }
      } else {
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
        if (sockets[node.socketId].hasListeners(node.eventName)) {
          sockets[node.socketId].removeListener(node.eventName, function () { });
        }
      }
    });

    node.on('close', function (done) {
      if (sockets[node.socketId].hasListeners(node.eventName)) {
        sockets[node.socketId].removeListener(node.eventName, function () {
          node.status({});
          done();
        });
      } else {
        node.status({});
        done();
      }

    });
  }
  RED.nodes.registerType('reskillai-inference', InferenceListener);

  function InferenceToggle(n) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    /*    this.eventName = n.eventname;*/
    this.socketId = null;
    this.project = n.project;
    this.model = n.model;
    this.classes = n.classes;
    this.imageResize = n.imageResize;
    this.detectionThreshold = n.detectionThreshold;
    var node = this;

    node.on('input', function (msg) {
      if (msg.payload != null) {
        if(msg.payload?.socketId && msg.payload?.status == 'connected') {
          node.socketId = msg.payload.socketId;
          return;
        }
        if (!node.socketId) return;
        if(msg.payload == 'start'){
          sockets[node.socketId].emit('inferSettings', {
            project: node.project,
            model: node.model,
            classes: "background," + node.classes,
            imageResize: node.imageResize,
            detectionThreshold: node.detectionThreshold,
          });
          sockets[node.socketId].emit("start", "inference")
          node.status({ fill: 'green', shape: 'dot', text: 'Started' });
        } else if (msg.payload == 'stop') {
          sockets[node.socketId].emit("stop", "inference")
          node.status({ fill: 'red', shape: 'ring', text: 'Stopped' });
        }
      } else {
        node.status({ fill: 'red', shape: 'ring', text: 'Config Error' });
      }
    });
  }
  RED.nodes.registerType('inference-toggle', InferenceToggle);

  function connect() {
    var uri = 'wss://reskillai.local:12345'; //TODO: FOR ACTUAL DEPLOYMENT USE RESKILLAI>LOCAL
    var options = {rejectUnauthorized: false};
    return require('socket.io-client')(uri, options);;
  }
}
