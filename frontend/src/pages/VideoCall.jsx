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
  const videoContainer = useRef();

  const navigate = useNavigate();
  const params = useParams();

  const myVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        myVideo.current.srcObject = stream;

        socket.emit("join-room", params.id);

        socket.on("your-id", (id) => {
          setMyUserId(id);
        });

        socket.on("all-users", (users) => {
          users.forEach((userID) => {
            if (!peersRef.current[userID]) {
              const peer = createPeer(userID, socket.id, stream);
              peersRef.current[userID] = peer;
              setPeers((prevPeers) => [...prevPeers, { peerID: userID, peer }]);
            }
          });
        });

        socket.on("user-joined", (payload) => {
          if (!peersRef.current[payload.callerID]) {
            const peer = addPeer(payload.signal, payload.callerID, stream);
            peersRef.current[payload.callerID] = peer;
            setPeers((prevPeers) => [
              ...prevPeers,
              { peerID: payload.callerID, peer },
            ]);
          }
        });

        socket.on("receiving-returned-signal", (payload) => {
          const peer = peersRef.current[payload.id];
          if (peer) {
            peer.signal(payload.signal);
          }
        });

        socket.on("user-disconnected", (userId) => {
          removePeer(userId);
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
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};
      setPeers([]);
    };
  }, [params.id]);

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("sending-signal", { userToSignal, callerID, signal });
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
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
  };

  const removePeer = (peerId) => {
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].destroy();
      delete peersRef.current[peerId];
    }
    setPeers((prevPeers) => prevPeers.filter((p) => p.peerID !== peerId));
  };

  return (
    <div className="p-8 flex flex-col items-center gap-4">
      <div className="flex flex-col items-center">
        <video ref={myVideo} autoPlay playsInline muted className="rounded-lg w-80" />
        <p className="text-white">You ({role})</p>
      </div>

      {peers.map((peer, index) => (
        <Video key={index} peer={peer.peer} />
      ))}

      <Chat />
    </div>
  );
};

const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="flex flex-col items-center">
      <video ref={ref} autoPlay playsInline className="rounded-lg w-80" />
      <p className="text-white">Interviewer</p>
    </div>
  );
};

export default VideoCall;
