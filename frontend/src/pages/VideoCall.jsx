import React, { useEffect, useRef, useState, useCallback } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { BsTelephoneX, BsCameraVideo, BsMic, BsMicMute, BsCameraVideoOff } from "react-icons/bs";
import Chat from "../components/Chat";
import { useStore } from "../store/store.js";

const API_URL = import.meta.env.VITE_API_URL;

const socket = io.connect(`${API_URL}`, {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

const VideoCall = () => {
  const { user } = useStore();
  const [role, setRole] = useState(user.role);
  const [peers, setPeers] = useState([]);
  const [myUserId, setMyUserId] = useState(null);
  const [userCount, setUserCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const myVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const videoContainerRef = useRef();
  
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      streamRef.current = stream;
      myVideo.current.srcObject = stream;
      socket.emit("join-room", params.id);

      socket.on("your-id", (id) => setMyUserId(id));

      socket.on("all-users", (users) => {
        setUserCount(users.length + 1);
        const newPeers = users.map((userID) => {
          if (!peersRef.current[userID]) {
            const peer = new Peer({ initiator: true, trickle: false, stream });
            peersRef.current[userID] = peer;
            return { peerID: userID, peer };
          }
          return null;
        }).filter(Boolean);
        setPeers((prevPeers) => [...prevPeers, ...newPeers]);
      });

      socket.on("user-joined", (payload) => {
        setUserCount((prevCount) => prevCount + 1);
        if (!peersRef.current[payload.callerID]) {
          const peer = new Peer({ initiator: false, trickle: false, stream });
          peer.signal(payload.signal);
          peersRef.current[payload.callerID] = peer;
          setPeers((prevPeers) => [...prevPeers, { peerID: payload.callerID, peer }]);
        }
      });

      socket.on("user-disconnected", (userId) => {
        setUserCount((prevCount) => prevCount - 1);
        if (peersRef.current[userId]) {
          peersRef.current[userId].destroy();
          delete peersRef.current[userId];
          setPeers((prevPeers) => prevPeers.filter((p) => p.peerID !== userId));
        }
      });
    });
  }, [params.id]);

  const toggleVideo = () => {
    setVideoEnabled((prev) => !prev);
    streamRef.current.getVideoTracks()[0].enabled = !videoEnabled;
  };

  const toggleAudio = () => {
    setAudioEnabled((prev) => !prev);
    streamRef.current.getAudioTracks()[0].enabled = !audioEnabled;
  };

  const handleDisconnect = () => {
    socket.emit("disconnect-from-room", params.id);
    navigate("/createroom");
  };

  return (
    <div className="p-4 flex flex-row items-start gap-4">
      <div className="flex flex-col gap-4 w-3/4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <video ref={myVideo} autoPlay playsInline muted className="rounded-lg w-full h-auto" />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
              You ({role})
            </div>
          </div>
          {peers.map(({ peerID, peer }) => (
            <Video key={peerID} peer={peer} />
          ))}
        </div>

        <div className="flex justify-center gap-4 mt-4">
          <button onClick={toggleVideo} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
            {videoEnabled ? <BsCameraVideo /> : <BsCameraVideoOff />} Video
          </button>
          <button onClick={toggleAudio} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
            {audioEnabled ? <BsMic /> : <BsMicMute />} Audio
          </button>
          <button onClick={handleDisconnect} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
            <BsTelephoneX /> End Call
          </button>
        </div>
      </div>

      <Chat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
};

const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    if (peer) {
      peer.on("stream", (stream) => {
        if (ref.current) {
          ref.current.srcObject = stream;
        }
      });
    }
  }, [peer]);

  return (
    <div className="relative">
      <video ref={ref} autoPlay playsInline className="rounded-lg w-full h-auto" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        Peer
      </div>
    </div>
  );
};

export default VideoCall;
