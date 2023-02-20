import axios from "axios";
import React, { useCallback, useMemo, useState } from "react";
import "./App.css";
import { API_BASE_URL, APP_API_TOKEN, APP_UUID, VIEWER_AUTH } from "./config";
import { createSocketInstance } from "./useSocket";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    authorization: `Bearer ${APP_API_TOKEN}`,
  },
});

const DEFAULT_SOCKET_NUM = 10;

let instances: Array<any> = [];

const sleep = async (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const getCommentChannel = (room: string) => `comment_${room}`;
export const getSendChannel = (userId: string) => `gift_send_${userId}`;
export const getReceiveChannel = (userId: string) => `gift_receive_${userId}`;
export const getBuyerChannel = (userId: string) => `user_buy_product_${userId}`;
export const getSellerChannel = (userId: string) =>
  `user_seller_product_${userId}`;

function App() {
  let messageTemp: Array<string> = [];
  const [messages, setMessages] = useState<Array<string>>([]);
  const [socketNum, setSocketNum] = useState<number>(DEFAULT_SOCKET_NUM);
  const [loading, setLoading] = useState<boolean>(false);
  const [sendGiftLoadings, _setSendGiftLoadings] = useState<
    Record<string, boolean>
  >({});
  const [streamId, setStreamId] = useState("");
  const [streamerId, setStreamerId] = useState("");
  const [giftId, setGiftId] = useState("bbb4b836be2"); //70 coin

  const ROOM_CHAT = `${streamerId}_${APP_UUID}`;

  const setSendGiftLoadings = useCallback(
    (id: string, value: boolean) => {
      _setSendGiftLoadings({
        ...sendGiftLoadings,
        [id]: value,
      });
    },
    [sendGiftLoadings]
  );

  const roomChat = getCommentChannel(ROOM_CHAT);

  async function pushView() {
    await api({
      method: "post",
      url: `/livestreams`,
      data: {
        streamId,
        appId: APP_UUID,
        accessToken: VIEWER_AUTH.accessToken,
        userRecordId: VIEWER_AUTH.userId,
        Action: "IncrementView",
      },
    });
  }

  const sendGift = useCallback(async () => {
    const body = {
      appid: APP_UUID,
      userSendId: VIEWER_AUTH.userId,
      userReceiveId: streamerId,
      coinFieldId: "coin",
      giftId,
      accessToken: VIEWER_AUTH.accessToken,
      room: streamerId,
    };
    await api({
      method: "post",
      url: `iaps/send-gift`,
      data: body,
    });
    await sleep(1000);
  }, [giftId, streamerId]);

  const sendMessage = useCallback(
    (data: {
      instance: any;
      index: number;
      message: string;
      callback?: (msg: string) => void;
      room?: string;
      type?: string;
    }) => {
      const {
        instance,
        index,
        message,
        callback,
        room = roomChat,
        type,
      } = data;
      const text = `SOCKET ${index} - ${instance.id}: ${message}`;
      const messageData = {
        text,
        type,
      };
      instance.emit(
        "create",
        "livestreams",
        {
          Action: "Comment",
          room,
          userRecordId: VIEWER_AUTH.userId,
          userInfo: {
            avatar: `https://picsum.photos/id/${(+index || 0) * 2}/1000`,
            username: VIEWER_AUTH.username,
          },
          appId: APP_UUID,
          accessToken: VIEWER_AUTH.accessToken,
          message: messageData,
        },
        (err: any, data: any) => {
          if (err) {
            console.error("error emit message", err.message);
          } else {
            console.log(`${instance.id} has been emmitted: ${message} ${room}`);
            callback && callback(text);
          }
        }
      );
    },
    [roomChat]
  );

  const handleCreateSocketInstance = useCallback(
    (
      total: number,
      socketNumber: number,
      callback: (message: string) => void,
      onDone: () => void
    ) => {
      if (socketNumber < total) {
        // join chat
        const channel = roomChat;
        const instance = createSocketInstance({
          channel,
          onConnection: (socket) => {
            callback && callback("connected");
            sendMessage({
              instance: socket,
              index: socketNumber,
              room: channel,
              type: "join",
              message: "joined",
              callback: () => {
                if (socketNumber + 1 === total) {
                  onDone();
                }
              },
            });
          },
          onDisconnect: (socket) => {
            const message = `Socket ${socketNumber} - ${socket.id} disconnected!`;
            console.log(message);
            callback && callback(message);
          },
        });
        // increment totalView
        pushView();
        instances.push(instance);
        handleCreateSocketInstance(total, socketNumber + 1, callback, onDone);
      }
    },
    [pushView, roomChat, sendMessage]
  );

  const createSocketInstances = useCallback(async () => {
    // create socket instance
    setLoading(true);
    handleCreateSocketInstance(
      socketNum,
      0,
      (message: string) => {
        setMessages([message, ...messageTemp]);
      },
      () => {
        setLoading(false);
      }
    );
  }, [handleCreateSocketInstance, messageTemp, socketNum]);

  const sendMessagesAll = useCallback(() => {
    console.log("instances", instances);
    setLoading(true);
    const sendMessageSingle = (index = 0) => {
      if (index < instances.length) {
        const instance = instances[index];
        sendMessage({
          instance,
          index,
          message: "new message =))",
          callback: (message: string) => {
            setMessages([message, ...messageTemp]);

            if (index === instances.length - 1) {
              setLoading(false);
            }
          },
        });
        sendMessageSingle(index + 1);
      }
    };
    sendMessageSingle();
  }, [messageTemp, sendMessage]);

  const sendGiftAll = () => {
    const sendSingle = (index = 0) => {
      if (index < instances.length) {
        const instance = instances[index];
        setSendGiftLoadings(instance.id, true);
        sendGift().finally(() => {
          setSendGiftLoadings(instance.id, false);
        });
        sendSingle(index + 1);
      }
    };
    sendSingle();
  };

  const renderSendGiftBtn = useCallback(
    (instance: any) => {
      return (
        <button
          disabled={sendGiftLoadings[instance.id]}
          onClick={() => {
            // action
            setSendGiftLoadings(instance.id, true);
            sendGift().finally(() => {
              setSendGiftLoadings(instance.id, false);
            });
          }}
        >
          Send gift
        </button>
      );
    },
    [sendGift, sendGiftLoadings, setSendGiftLoadings]
  );

  const configCommon = useMemo(() => {
    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <p>Add Socket num</p>
          <input
            value={socketNum}
            onChange={(e) => {
              setSocketNum(+e.target.value);
            }}
            type="number"
            placeholder={"number of socket"}
            disabled={loading}
          />
          <p>StreamId</p>
          <input
            value={streamId}
            onChange={(e) => {
              setStreamId(e.target.value);
            }}
            placeholder={"StreamId"}
          />
          <p>Streamer Id</p>
          <input
            value={streamerId}
            onChange={(e) => {
              setStreamerId(e.target.value);
            }}
            placeholder={"Streamer Id"}
          />
        </div>
      </>
    );
  }, [loading, socketNum, streamId, streamerId]);

  return (
    <div className="App">
      {loading && <div>Processing</div>}
      <p>Room chat: {roomChat}</p>
      {configCommon}
      <button onClick={createSocketInstances} disabled={loading}>
        Connect socket
      </button>
      <button onClick={sendMessagesAll} disabled={loading}>
        Send all messages
      </button>
      <button onClick={sendGiftAll}>Send gift all</button>

      {instances.map((instance, index) => {
        return (
          <div key={`${index}_${instance?.id}`}>
            {instance.id ? (
              <>
                <br />
                <div>{instance.id} </div>
                <button
                  onClick={() => {
                    sendMessage({
                      instance,
                      index,
                      message: "new message =))",
                      callback: (message: string) => {
                        messageTemp = [message, ...messageTemp];
                        setMessages([...messageTemp]);
                      },
                    });
                  }}
                >
                  Send messgae
                </button>
                {renderSendGiftBtn(instance)}
                <button
                  onClick={() => {
                    // action
                    alert("not implemented!");
                  }}
                >
                  Buy product
                </button>
              </>
            ) : (
              <div>
                <br />
                ...
              </div>
            )}
          </div>
        );
      })}
      {/* {messages.map((message) => (
        <p key={message}>{message}</p>
      ))} */}
    </div>
  );
}

export default App;
