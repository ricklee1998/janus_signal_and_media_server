
//var app = require('express')();
//var http = require('http').Server(app);
//var io = require('socket.io')(http);
const signalServerConnectURL = 'http://localhost:4545';

(function init() {
    if (signalServerConnectURL) {
        try {
            signalSocketIo = io.connect(signalServerConnectURL, { reconnect: true, 'transports': ['websocket'] });
            console.log(signalSocketIo);
            console.log("접속성공")
        } catch (err) {
            console.warn('signaling server connect error.');
        }
    }
})();

const loginBtn = document.getElementById("loginBtn");
const roomBtn = document.getElementById("roomBtn");
const videoBox = document.getElementById("videoBox");

let janusStreams = {};
let janusStreamPeers = {};
let userId= Math.floor(Math.random() * 100);
let youruserId;
let people = {};
//cam설정 화면 제한
let cam_2 = [960, 540, 1382000, 15];
let cam_4 = [640, 360, 230000, 12];
let mediaConstraint ={
    video:{
        width:{min: cam_2[0], ideal: cam_2[0]},
		height:{min: cam_2[1], ideal: cam_2[1]},
		frameRate: {
			ideal: cam_2[3],
			max: cam_2[3]
		}
	},
	audio: true,
};
let bitrate = cam_2[2];
////////////////////////////////////////////////////////////////////////
const plusOne = (id) => {
	people[id] = true;
	let nop = Object.keys(people).length;
	if(nop == 2){
		
		document.getElementById('videoBox').style.gridTemplateColumns = "repeat(auto-fill, minmax(50%, auto))";
	}
}
////////////////////////////////////////////////////////////////////////
const createVideoBox = userId => {
    console.log("무조건확인해야한다1:"+ userId);
	let videoContainner = document.createElement("div");
	videoContainner.classList = "multi-video";
	videoContainner.id = userId;

	let videoLabel = document.createElement("p");
	let videoLabelText = document.createTextNode(userId);
	videoLabel.appendChild(videoLabelText);

	videoContainner.appendChild(videoLabel);

	let multiVideo = document.createElement("video");
	multiVideo.autoplay = true;
	multiVideo.id = "multiVideo-" + userId;
	videoContainner.appendChild(multiVideo);
	videoBox.appendChild(videoContainner);
	plusOne(userId);

}
////////////////////////////////////////////////////////////////////////
const createSDPOffer = async dataId => {
    console.log("무조건확인해야한다2:"+ youruserId);
	janusStreams[youruserId] = await navigator.mediaDevices.getUserMedia(mediaConstraint);

    let str = 'multiVideo-'+youruserId;
    let multiVideo = document.getElementById(str);
    multiVideo.srcObject = janusStreams[youruserId];
    multiVideo.muted = true
	
	janusStreamPeers[youruserId] = new RTCPeerConnection();
	janusStreams[youruserId].getTracks().forEach(track => {
		janusStreamPeers[youruserId].addTrack(track, janusStreams[youruserId]);
	});

	janusStreamPeers[youruserId].createOffer().then(sdp => {
		janusStreamPeers[youruserId].setLocalDescription(sdp);
		return sdp;
	}).then(sdp => {
        let data = {
            "eventOp":"sdpoffer",
            "userId":youruserId,
            "sdp": sdp,
        }
        signalSocketIo.emit('sdpconnect', data);
		//janus.createOffer(ws,sdp);
	})
}
const createSDPAnswer = async data => {
	let tempId = data.plugindata.data.display;
	janusStreamPeers[tempId] = new RTCPeerConnection();
	janusStreamPeers[tempId].ontrack = e => {
		janusStreams[tempId] = e.streams[0];
		let multiVideo = document.querySelector("#multiVideo-" + tempId);
		multiVideo.srcObject = janusStreams[tempId];
	}

	await janusStreamPeers[tempId].setRemoteDescription(data.jsep);
	let answerSdp = await janusStreamPeers[tempId].createAnswer();
	await janusStreamPeers[tempId].setLocalDescription(answerSdp);
	janusStreamPeers[tempId].onicecandidate = e => {
		if(!e.candidate){
            let data = {
                "eventOp":"sdpcandidate",
                "userId":userId,
                "tempId":tempId,
                "sdp": sdp,
            }
            signalSocketIo.emit('sdpconnect', data);
			
		}
	}
}

////////////////////////////////////////////////////////////////////////
function receiveMsg(data) {
    const LR = (data.userId != userId)? "left" : "right";
    if(LR==="right"){
        appendMessageTag("right", data.userId, data.msg);
    }else{
        appendMessageTag("left", data.userId, data.msg);
    }
    
}
function receiveLogin(data) {
    const LR = (data.userId != userId)? "left" : "right";
    
}

loginBtn.addEventListener('click', () => {
    let data = {
        "eventOp":"login",
        "userId":userId,
    }
    signalSocketIo.emit('login', data);
});

roomBtn.addEventListener('click', async () => {
    let data = {
        "eventOp":"roomjoin",
        "userId":userId,
        "subFlag":true,
    }
    signalSocketIo.emit('roomjoin', data);
    // let sdp = await createSDPOffer(userId);
    // let data = {
    //     "eventOp":"sdpconnect",
    //     "userId": userId,
    //     "sdp": sdp,
    //     "event": "offer",
    // }
    // signalSocketIo.emit('sdpconnect', data);
});
signalSocketIo.on('login', function(data) {
    receiveLogin(data);
    // let user = document.getElementById(data.userId);
    // if(!user){
    //     createVideoBox(data.userId);
    // }
    console.log("서버에서 로그인확인완료"+data.userId);
});
signalSocketIo.on('sdpoffer', function(data){
    console.log("서버에서 sdp오퍼확인완료"+data.userId);
    youruserId = data.userId
    createVideoBox(youruserId);
    createSDPOffer(youruserId);
});
signalSocketIo.on('sdpanswer', function(data){
    console.log("서버에서 sdp엔써확인완료"+data.userId);
    createVideoBox(data.msgObj.plugindata.data.display);
    createSDPAnswer(data.msgObj);
});
signalSocketIo.on('sdpconnect', async data => {
    console.log("서버에서 sdp확인완료");
    switch(data.eventOp){
        case 'sdpconnect':
            if(data.sdp && data.sdp.type == 'offer'){
                createSDPAnswer(data);
            }else if(data.sdp && data.sdp.type == 'answer'){
                console.log("이상증상1");
                peers[userId].setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
            break;
    }
    
});