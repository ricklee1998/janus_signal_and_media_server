/******************************************************************/
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 4545;
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});
/******************************************************************/
const WebSocket = require('ws');
const janusURL = 'ws://106.240.247.43:9501';
var ws = new WebSocket(janusURL, 'janus-protocol');
const janus = {};
/******************************************************************/
//피어 설정
var session_id;
var publish_id;
var subscriber_ids = {};
var subscriberTransaction = {};
var subscriberFeedId = {};
var feedIdToId = {};
var op;

let janusStreams = {};
let janusStreamPeers = {};
let userId;
let people = {};
////////////////////////////////////////////////////////////////////
//ws 웹소켓
io.on('connection', function(socket){
ws.onopen = () => {
	console.log(`WebSocket ${janusURL} has connected!`);
}
ws.onerror = error => {
	console.log(`WebSocket error : `,error);
}
ws.onmessage = e => {
  getMsg(e.data);
  console.log("getMsg");
}
ws.onclose = () => {
	console.log(`WebSocket has closed `);
}
////////////////////////////////////////////////////////////////////
//transaction 값 생성
const getTrxID = () => {
	var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var randomString = '';
	for(var i=0;i<12;i++){
		var randomPoz = Math.floor(Math.random()*charSet.length);
		randomString += charSet.substring(randomPoz, randomPoz+1);
	}
	return randomString;
}
////////////////////////////////////////////////////////////////////
//receive Data OP
const getMsg = (msg) => {
  let msgObj = JSON.parse(msg);
  //keep alive
  if(msgObj.janus !== 'ack'){
      console.log('receive', JSON.parse(msg));
  }
  switch(msgObj.janus){
      case 'success':
          switch(op){
              case 'create':
                session_id = msgObj.data.id;
                janus.attachPlugin(ws, userId, session_id, 'janus.plugin.videoroom',true);
                break;
              case 'attachPublisher':
                publish_id = msgObj.data.id;
                janus.destroyRoom(ws);
                break;
              case 'destroyVideoRoom':
                console.log("데리룸받음");
                janus.createVideoRoom(ws)
                break;
              case 'createVideoRoom':
                janus.joinVideoRoom(ws,"19980124")
                break;
              case 'joinVideoRoom':
                break;
          }
          break;
      case 'event':
      {
        if(msgObj.plugindata.data.videoroom == 'joined'){
          let publishers = msgObj.plugindata.data.publishers;
          publishers.forEach(element => {
            subscriberFeedId[element.display] = element.id;
            feedIdToId[element.id] = element.display;
            janus.attachPlugin(ws,element.display,session_id,'janus.plugin.videoroom', false);
          })
          let senddata ={
            "eventOp":"sdpoffer",
            "userId": userId,
          }
          io.sockets.emit('sdpoffer', senddata)
          //createVideoBox(userId);
          //createSDPOffer(userId);
        }
        if(msgObj.plugindata.data.configured == 'ok'){
          if(msgObj.jsep)
            janusStreamPeers[userId].setRemoteDescription(msgObj.jsep);
        }
        if(msgObj.jsep && msgObj.jsep.type === 'offer'){
          let senddata ={
            "eventOp":"sdpanswer",
            "userId": userId,
            "msgObj": msgObj,
          }
          io.sockets.emit('sdpanswer', senddata)
          //createVideoBox(msgObj.plugindata.data.display);
          //createSDPAnswer(msgObj);
        }
        if(msgObj.plugindata.data.videoroom != 'joined' && msgObj.plugindata.data.publishers && msgObj.plugindata.data.publishers.length > 0){
          subscriberFeedId[msgObj.plugindata.data.publishers[0].display] = msgObj.plugindata.data.publishers[0].id;
          feedIdToId[msgObj.plugindata.data.publishers[0].id] = msgObj.plugindata.data.publishers[0].display;

          janus.attachPlugin(ws, msgObj.plugindata.data.publishers[0].display, session_id, 'janus.plugin.videoroom', false );
        }
        break;
      }
      default:
        break;
  }
}
////////////////////////////////////////////////////////////////////
//send Data OP
janus.createSession = ws => {
  // [receive] {"janus":"success","transaction":"V0sOyQrYVZ1N","data":{"id":515042623976119}}
  // [send] {"janus":"create","transaction":"V0sOyQrYVZ1N"}
  let trxid = getTrxID();
  op = 'create';
  let msg = {
    janus: op,
    transaction: trxid
    };
    console.log('send', msg);
    ws.send(JSON.stringify(msg));
    return trxid;
}
janus.attachPlugin = (ws, userNickName, session_id, plugin_name, isPublisher) => {
  // [receive] {"janus":"success","session_id":7907193649270930,"transaction":"uX5HR9UYQ1d8","data":{"id":118160198284110}}
  // [send] {"janus":"attach","transaction":"uX5HR9UYQ1d8","opaqueId":"user1","session_id":7907193649270930,"plugin":"janus.plugin.videoroom"}
  let trxid = getTrxID();
  if(isPublisher){
    op = 'attachPublisher';
  } else {
    op = 'attachSubscriber';
    subscriberTransaction[trxid] = userNickName;
  }
  let msg = {
    janus: 'attach',
    transaction: trxid,
    opaqueId: userNickName,
    session_id : session_id,
    plugin : plugin_name,
  };

  console.log('send', msg);
  ws.send(JSON.stringify(msg));
  return trxid;
}
janus.destroyRoom = (ws) => {
  // [receive] {"janus":"success","session_id":4235116192647646,"transaction":"t5JQwnGAiYC2","sender":4626551672571911,"plugindata":{"plugin":"janus.plugin.videoroom","data":{"videoroom":"destroyed","room":"19980124","permanent":false}}}
  // [send] {"janus":"message","session_id":4235116192647646,"handle_id":4626551672571911,"transaction":"t5JQwnGAiYC2","body":{"request":"destroy","room":"19980124"}}
  console.log("데리룸");
  let trxid = getTrxID();
  op = 'destroyVideoRoom'
  let msg = {
    janus: 'message',
    session_id: session_id,
    handle_id: publish_id,
    transaction: trxid,
    body : {
      request: 'destroy',
      room: "19980124"
    }
  };

  console.log('send', msg);
  ws.send(JSON.stringify(msg));
}
janus.createVideoRoom = (ws) => {
  //[receive] {"janus":"success","session_id":3312660165882751,"transaction":"MNAG51YB1QnX","sender":2115027813358410,"plugindata":{"plugin":"janus.plugin.videoroom","data":{"videoroom":"created","room":"19980124","permanent":false}}}
  //[send] {"janus":"message","session_id":3312660165882751,"handle_id":2115027813358410,"transaction":"MNAG51YB1QnX","body":{"request":"create","room":"19980124","publishers":100,"audiolevel_event":false,"audio_level_average":70,"record":false,"rec_dir":"/opt/justin/share/janus/recordings/"}}
  console.log("크리룸");
  let trxid = getTrxID();
  op = 'createVideoRoom'
  let msg = {
    janus: 'message',
    session_id: session_id,
    handle_id: publish_id,
    transaction: trxid,
    body : {
      request: 'create',
      room: "19980124",
      publishers: 5,
      audiolevel_event: false,
      audio_level_average: 70,
      record: false,
      rec_dir: '/opt/justin/share/janus/recordings/'
    }
  };
  console.log('send', msg);
  ws.send(JSON.stringify(msg));
  return trxid;
}
janus.joinVideoRoom = (ws, roomId) => {
  //[receive] {"janus":"event","session_id":9002735655176441,"transaction":"VddAkEeE1Xyh","sender":4165890073971644,"plugindata":{"plugin":"janus.plugin.videoroom","data":{"videoroom":"joined","room":"19980124","description":"Room 19980124","id":"e2a7aa8f-6964-4210-8729-45b4c2eb0e00","private_id":3334407530,"publishers":[]}}}
  //[send] {"janus":"message","session_id":9002735655176441,"handle_id":4165890073971644,"transaction":"VddAkEeE1Xyh","body":{"request":"join","ptype":"publisher","room":"19980124","display":"test"}}
  let trxid = getTrxID();
  op = 'joinVideoRoom';
  let msg = {
    janus: 'message',
    session_id: session_id,
    handle_id: publish_id,
    transaction: trxid,
    body: {
      request: 'join',
      ptype: 'publisher',
      room: roomId,
      display: "test"
    }
  }

  console.log('send', msg);
  ws.send(JSON.stringify(msg));
}
janus.createOffer = (ws,sdp) => {
	let trxid = getTrxID();
	let msg = {
		janus: 'message',
		transaction: trxid,
		handle_id: publish_id,
		session_id: session_id,
		body:{
			request: 'publish',
			video: true,
			audio: true,
			display: userId,
			// bitrate
		},
		jsep: {
			type: sdp.type,
			sdp: sdp.sdp
		}
	}
	console.log('send', msg);
	ws.send(JSON.stringify(msg));
}
////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
/******************************************************************/

  console.log(socket.id);
  socket.on('login',function(data){
    console.log("로그인확인"+data.userId);
    let senddata ={
      "eventOp":"login",
      "userId":data.userId,
    }
    io.sockets.emit('login', senddata);
  });
  socket.on('roomjoin',function(data){
    console.log("룸조인확인:"+data.userId);
    userId = data.userId;
    // let senddata ={
    //   "eventOp":"chatting",
    //   "userId":data.userId,
    //   "msg":data.msg,
    // }
    // io.sockets.emit('chatting', senddata);
    janus.createSession(ws);
  });
  socket.on('sdpconnect', function(data){
    console.log(data.userId+"로부터"+"sdp: "+data.sdp.type+"타입으로옴");
    console.log("데이터이벤트:"+data.event)
    switch(data.eventOp){
      case 'sdpoffer':
        console.log("오퍼 들어옴");
        janus.createOffer(ws,data.sdp);
        break;
      case 'sdpcandidate':
        console.log("엔써 들어옴");
        let trxid = getTrxID();
        let msg = {
          janus: "message",
          transaction: trxid,
          handle_id: subscriber_ids[data.tempId],
          session_id: session_id,
          body: {
            request: "start",
            room: "19980124",
            video: true,
            audio: true,
          },
          jsep: janusStreamPeers[data.tempId].localDescription
        };

        console.log("send", msg);
        ws.send(JSON.stringify(msg));
    }
    
  });
    
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
