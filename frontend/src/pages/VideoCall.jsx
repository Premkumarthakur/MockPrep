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
  const [isSharing, setIsSharing] = useState(false);
  const screenVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const videoContainer = useRef();

  const navigate = useNavigate();
  const params = useParams();

  const myVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const myVoice = useRef();
  const videoRef = useRef();
  const hiddenVoice = useRef();

  // Peer creation and connection logic remains the same
  // (createPeer, addPeer, removePeer, useEffect hooks)

  const handleDisconnect = () => {
    socket.emit("disconnect-from-room", params.id);
    navigate("/createroom");
  };

  const handleVoice = () => {
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      myVoice.current.firstChild.src = audioTrack.enabled
        ? "/mic.png"
        : "/no-noise.png";
      hiddenVoice.current.style.display = audioTrack.enabled ? "none" : "block";
    }
  };

  const handleVideo = () => {
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      videoRef.current.firstChild.src = videoTrack.enabled
        ? "/video-camera.png"
        : "/no-video.png";
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screenVideoRef.current.srcObject = screenStream;
      screenStreamRef.current = screenStream;
      setIsSharing(true);
      videoContainer.current.classList.remove("hidden");
      screenStream.getVideoTracks()[0].onended = stopScreenShare;
    } catch (error) {
      console.error("Error sharing screen:", error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      videoContainer.current.classList.add("hidden");
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      setIsSharing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Screen Share Preview */}
      <div ref={videoContainer} className="hidden p-4 bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg border-2 border-green-400"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 h-[calc(100vh-100px)]">
        {/* Videos Column - 50% width */}
        <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
            <img
              ref={hiddenVoice}
              className="absolute top-2 right-2 w-8 p-1 bg-gray-600/80 rounded"
              src="/no-noise.png"
              alt="Muted"
            />
            <video
              ref={myVideo}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/50 text-white rounded text-sm">
              You ({role})
            </div>
          </div>

          {/* Remote Peers */}
          {peers.map((peer, index) => (
            <Video key={index} peer={peer.peer} />
          ))}
        </div>

        {/* Chat Column - 50% width */}
        <div className="w-1/2 bg-gray-800 rounded-xl p-4 flex flex-col">
          <Chat />
        </div>
      </div>

      {/* Control Bar */}
      <div className="h-20 bg-gray-800 flex items-center justify-center gap-4">
        <button
          ref={myVoice}
          onClick={handleVoice}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition"
        >
          <img src="/no-noise.png" className="w-8 h-8" alt="Microphone" />
        </button>

        <button
          ref={videoRef}
          onClick={handleVideo}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition"
        >
          <img src="/no-video.png" className="w-8 h-8" alt="Camera" />
        </button>

        {!isSharing ? (
          <button
            onClick={startScreenShare}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition"
          >
            Share Screen
          </button>
        ) : (
          <button
            onClick={stopScreenShare}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition"
          >
            Stop Sharing
          </button>
        )}

        <button
          onClick={handleDisconnect}
          className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition"
        >
          <BsTelephoneX className="text-2xl text-white" />
        </button>
      </div>
    </div>
  );
};

const Video = ({ peer }) => {
  const videoRef = useRef();
  const mutedRef = useRef();

  useEffect(() => {
    if (peer) {
      peer.on("stream", (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            mutedRef.current.style.display = audioTrack.enabled ? "none" : "block";
          }
        }
      });
    }
  }, [peer]);

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <img
        ref={mutedRef}
        className="absolute top-2 right-2 w-8 p-1 bg-gray-600/80 rounded"
        src="/no-noise.png"
        alt="Muted"
      />
      <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/50 text-white rounded text-sm">
        Peer
      </div>
    </div>
  );
};

export default VideoCall;
