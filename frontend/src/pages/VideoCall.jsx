import React, { useEffect, useRef, useState, useCallback } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { BsTelephoneX } from "react-icons/bs";
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
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const myVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const navigate = useNavigate();
  const params = useParams();

  const createPeer = useCallback((userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("sending-signal", { userToSignal, callerID, signal });
    });

    return peer;
  }, []);

  const addPeer = useCallback((incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("returning-signal", { signal, callerID });
    });

    peer.signal(incomingSignal);
    return peer;
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        myVideo.current.srcObject = stream;

        socket.emit("join-room", params.id);
        socket.on("your-id", (id) => setMyUserId(id));

        socket.on("all-users", (users) => {
          setUserCount(users.length + 1);
          users.forEach((userID) => {
            const peer = createPeer(userID, socket.id, stream);
            peersRef.current[userID] = peer;
            setPeers((prev) => [...prev, { peerID: userID, peer }]);
          });
        });

        socket.on("user-joined", (payload) => {
          setUserCount((prevCount) => prevCount + 1);
          const peer = addPeer(payload.signal, payload.callerID, stream);
          peersRef.current[payload.callerID] = peer;
          setPeers((prev) => [...prev, { peerID: payload.callerID, peer }]);
        });

        socket.on("receiving-returned-signal", (payload) => {
          const peer = peersRef.current[payload.id];
          peer && peer.signal(payload.signal);
        });

        socket.on("user-disconnected", (userId) => {
          setUserCount((prev) => prev - 1);
          setPeers((prev) => prev.filter((p) => p.peerID !== userId));
          if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];
          }
        });
      });

    return () => {
      socket.emit("disconnect-from-room", params.id);
      socket.off("your-id");
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-returned-signal");
      socket.off("user-disconnected");
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [params.id, addPeer, createPeer]);

  const handleDisconnect = () => {
    socket.emit("disconnect-from-room", params.id);
    navigate("/createroom");
  };

  const toggleAudio = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  return (
    <div className="flex h-screen p-4 gap-4">
      {/* Left - Video Section (50% width) */}
      <div className="w-1/2 flex flex-col gap-4">
        <div className="h-1/2 relative">
          <video ref={myVideo} autoPlay playsInline muted className="rounded-lg w-full h-full" />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            You ({role})
          </div>
        </div>

        {peers.map((peerObj, index) => (
          <Video key={index} peer={peerObj.peer} />
        ))}

        <div className="flex justify-center gap-4 mt-4">
          <button onClick={toggleAudio} className="p-2 rounded-lg bg-gray-600">
            <img src={isAudioOn ? "/mic.png" : "/no-noise.png"} alt="Audio Toggle" className="w-8 h-8" />
          </button>
          <button onClick={toggleVideo} className="p-2 rounded-lg bg-gray-600">
            <img src={isVideoOn ? "/video-camera.png" : "/no-video.png"} alt="Video Toggle" className="w-8 h-8" />
          </button>
          <button onClick={handleDisconnect} className="p-2 rounded-lg bg-red-600 flex items-center">
            <BsTelephoneX className="text-2xl text-white" />
          </button>
        </div>
      </div>

      {/* Right - Chat Section (50% width) */}
      <div className="w-1/2 border-l border-gray-400 p-4">
        <Chat />
      </div>
    </div>
  );
};

const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [peer]);

  return (
    <div className="h-1/2 relative">
      <video ref={ref} autoPlay playsInline className="rounded-lg w-full h-full" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        Interviewer
      </div>
    </div>
  );
};

export default VideoCall;
