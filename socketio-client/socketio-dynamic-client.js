module.exports = function(RED) {
  'use strict';
  // var io = require('socket.io-client');
  var sockets = {};

  /* sckt connector*/
    function ReskillAIConnector(n){
      RED.nodes.createNode(this, n);
      this.name = n.name;
      var node = this;
      
      if(sockets[node.id]){ delete sockets[node.id];}
      sockets[node.id] = connect();
        
      sockets[node.id].on('connect', function(){
        sockets[node.id].emit('user','node-red')
        node.send({ payload:{socketId:node.id, status:'connected'} });
        node.status({fill:"green",shape:"dot", text:"connected"});
      });

      sockets[node.id].on('disconnect', function(){
        node.send({payload:{socketId:node.id, status:'disconnected'}});
        node.status({fill:'red',shape:'ring', text:'disconnected'});
      });

      sockets[node.id].on('connect_error', function(err) {
        if (err) {
          node.status({fill:'red',shape:'ring',text:'disconnected'});
          node.send({payload:{socketId:node.id, status:'disconnected'}});
          //node.error(err);
        }
      }); 

      this.on('close', function(done) {
        sockets[node.id].disconnect();
        node.status({});
        done();
      }); 
    }
    RED.nodes.registerType('reskilai-connector', ReskillAIConnector);

    /* inference listener*/
    function InferenceListener(n){
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.socketId = null;
      var node = this;
      node.on('input', function(msg){
        node.socketId = msg.payload.socketId;
        if(msg.payload.status == 'connected'){
          node.status({fill:'green',shape:'dot',text:'listening'});
          if( !sockets[node.socketId].hasListeners('inference') ){
            sockets[node.socketId].on('inference', function(data){
              node.send( {payload:data} );
            });
          }
        } else {
          node.status({fill:'red',shape:'ring',text:'disconnected'});
          if( sockets[node.socketId].hasListeners(node.eventName) ){
            sockets[node.socketId].removeListener(node.eventName, function(){});
          }
        }
      });

      node.on('close', function(done) {
        if( sockets[node.socketId].hasListeners(node.eventName) ){
          sockets[node.socketId].removeListener(node.eventName, function(){
            node.status({});
            done();
          });
        }else{
          node.status({});
          done();
        }
            
      }); 
    }
    RED.nodes.registerType('reskillai-inference', InferenceListener);

  function connect() {
    var uri = 'ws://localhost:12345'; //TODO: FOR ACTUAL DEPLOYMENT USE RESKILLAI>LOCAL
    var options = {};
    return require('socket.io-client')( uri, options );;
  }
}
