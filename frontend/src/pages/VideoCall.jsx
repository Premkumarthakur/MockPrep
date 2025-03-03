import React, { useEffect, useRef, useState, useCallback } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { BsTelephoneX } from "react-icons/bs";
import Chat from "../components/Chat";
import { useStore } from "../store/store.js";
import "./VideoCall.css"; // Import custom CSS file

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
    <div className="video-call-container">
      {/* Screen Share Preview */}
      <div ref={videoContainer} className="screen-share-preview hidden">
        <div className="screen-share-wrapper">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="screen-share-video"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Videos Column - 50% width */}
        <div className="videos-column">
          {/* Local Video */}
          <div className="video-wrapper local-video">
            <img
              ref={hiddenVoice}
              className="muted-indicator"
              src="/no-noise.png"
              alt="Muted"
            />
            <video
              ref={myVideo}
              autoPlay
              playsInline
              muted
              className="video-element"
            />
            <div className="video-label">You ({role})</div>
          </div>

          {/* Remote Peers */}
          {peers.map((peer, index) => (
            <Video key={index} peer={peer.peer} />
          ))}
        </div>

        {/* Chat Column - 50% width */}
        <div className="chat-column">
          <Chat />
        </div>
      </div>

      {/* Control Bar */}
      <div className="control-bar">
        <button ref={myVoice} onClick={handleVoice} className="control-button">
          <img src="/no-noise.png" className="control-icon" alt="Microphone" />
        </button>

        <button ref={videoRef} onClick={handleVideo} className="control-button">
          <img src="/no-video.png" className="control-icon" alt="Camera" />
        </button>

        {!isSharing ? (
          <button onClick={startScreenShare} className="control-button share-button">
            Share Screen
          </button>
        ) : (
          <button onClick={stopScreenShare} className="control-button stop-share-button">
            Stop Sharing
          </button>
        )}

        <button onClick={handleDisconnect} className="control-button disconnect-button">
          <BsTelephoneX className="disconnect-icon" />
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
    <div className="video-wrapper remote-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="video-element"
      />
      <img
        ref={mutedRef}
        className="muted-indicator"
        src="/no-noise.png"
        alt="Muted"
      />
      <div className="video-label">Peer</div>
    </div>
  );
};

export default VideoCall;
