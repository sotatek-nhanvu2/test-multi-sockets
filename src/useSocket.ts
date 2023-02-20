import { API_BASE_URL, APP_UUID, VIEWER_AUTH } from "./config";

const io = require("socket.io-client");

type CreateSocketInstance = {
  onConnection?: (socket: any) => void;
  onDisconnect?: (socket: any) => void;
  channel: string;
};

export const createSocketInstance = ({
  onConnection,
  onDisconnect,
  channel,
}: CreateSocketInstance) => {
  const socketInstance = io(API_BASE_URL, {
    query: {
      channel, // required name 'channel'
      appId: APP_UUID,
    },
    transports: ["websocket"],
    transportOptions: {
      websocket: {
        extraHeaders: {
          userid: VIEWER_AUTH.userId,
        },
      },
    },
  });

  socketInstance.on("connect", () => {
    console.log(`${socketInstance.id} Connected to server`);
    onConnection && onConnection(socketInstance);
  });

  socketInstance.on("disconnect", () => {
    console.log("Disconnected to server");
    onDisconnect && onDisconnect(socketInstance);
  });

  return socketInstance;
};
