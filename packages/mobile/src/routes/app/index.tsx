import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppParamList } from "../../params";
import { TabIcon } from "../../components";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { Messages, Settings, Profile } from "../../screens/app";
import { COLORS, FONTS } from "../../constants";
import { AppState } from "react-native";
import { trpc } from "../../utils/trpc";
import { useDispatch, useSelector } from "react-redux";
import { StateType } from "../../types";
import * as Location from "expo-location";
import { sendPushNotification } from "../../utils";
import {
  useLocationPermission,
  useNotificationsToken,
  useSensorsPermission,
} from "../../hooks";
import { Message, User, UserOnlineType } from "@askme/server";
import { MessageType } from "@askme/server/src/types";
import { setMyLocation, setUserSettings } from "../../actions";

const Tab = createBottomTabNavigator<AppParamList>();
const App = () => {
  const { user, openedChatId } = useSelector((state: StateType) => state);
  const [onlineUser, setOnlineUser] = useState<UserOnlineType | undefined>();
  const [newUserJoin, setNewUserJoined] = useState<User | null>(null);
  const [newMsg, setNewMsg] = useState<MessageType | undefined>(undefined);

  const [newReaction, setNewReaction] = useState<{
    message: Message;
    reactor: User;
  } | null>(null);
  const { granted: locationPermission } = useLocationPermission();
  // const { granted: sensorsPermission } = useSensorsPermission({});
  const { token } = useNotificationsToken({});
  const dispatch = useDispatch();

  const appState = React.useRef(AppState.currentState);
  const [isOnline, setIsOnline] = React.useState<boolean>(
    appState.current === "active"
  );
  const { data: mySettings } = trpc.settings.mySettings.useQuery();

  // notify others about my online state
  trpc.user.onUserOnline.useSubscription(
    { userId: user?.id ?? "" },
    {
      onData: ({ user, status }) => {
        setOnlineUser({
          status,
          user,
        });
      },
    }
  );
  trpc.messages.onMessageReactionNotification.useSubscription(
    { userId: user?.id ?? "" },
    {
      onData: (data) => {
        setNewReaction(data);
      },
    }
  );

  trpc.user.onNewUserJoined.useSubscription(undefined, {
    onData: (data) => {
      setNewUserJoined(data);
    },
  });
  trpc.messages.onNewMessage.useSubscription(
    { uid: user?.id ?? "" },
    {
      onData: async (data) => {
        setNewMsg(data);
      },
    }
  );
  const { mutate } = trpc.user.updateUserStateAndNotify.useMutation();

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setIsOnline(nextAppState === "active");
    });
    return () => {
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    let mounted: boolean = true;
    if (mounted) {
      (async () => {
        await mutate({ isOnline });
      })();
    }
    return () => {
      mounted = false;
    };
  }, [isOnline]);

  React.useEffect(() => {
    let mounted: boolean = true;
    if (mounted) {
      (async () => {
        await mutate({ isOnline });
      })();
    }
    return () => {
      mounted = false;
    };
  }, [isOnline]);

  React.useEffect(() => {
    let mounted: boolean = true;
    if (
      mounted &&
      !!onlineUser &&
      !!token &&
      !!user?.settings?.enableNotifications
    ) {
      (async () => {
        await sendPushNotification(
          token,
          `askme - @${onlineUser.user?.nickname}`,
          onlineUser.status === "online"
            ? `${onlineUser.user?.nickname} is now online`
            : `${onlineUser.user?.nickname} went offline.`
        );
      })();
    }
    return () => {
      mounted = false;
    };
  }, [onlineUser, token, user]);
  React.useEffect(() => {
    let mounted: boolean = true;
    if (
      mounted &&
      !!newMsg &&
      !!token &&
      !!user?.settings?.enableNotifications
    ) {
      (async () => {
        if (openedChatId !== newMsg.chatId && newMsg.userId !== user?.id) {
          await sendPushNotification(
            token,
            `askme - @${newMsg.sender.nickname}`,
            `${newMsg.message}`
          );
          setNewMsg(undefined);
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [newMsg, token, openedChatId, user]);

  React.useEffect(() => {
    let mounted: boolean = true;
    if (
      mounted &&
      !!newMsg &&
      !!token &&
      !!user?.settings?.enableNotifications
    ) {
      (async () => {
        if (
          openedChatId !== newReaction?.message.chatId &&
          !!newReaction &&
          user?.id === newReaction.message.userId
        ) {
          await sendPushNotification(
            token,
            `askme - @${newReaction.reactor.nickname}`,
            `Reacted "💓" to your message "${newReaction.message.message}"`
          );
          setNewReaction(null);
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [newReaction, token, openedChatId]);

  React.useEffect(() => {
    let mounted: boolean = true;
    if (
      mounted &&
      !!newUserJoin &&
      !!token &&
      user?.id &&
      !!user.settings?.enableNotifications
    ) {
      (async () => {
        if (user.id !== newUserJoin.id) {
          if (user.settings?.enableNotifications) {
            await sendPushNotification(
              token,
              `askme - @${newUserJoin.nickname}`,
              `${newUserJoin.nickname} just joined hopefully they are in your space.`
            );
          }
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [newUserJoin, token, user]);

  React.useEffect(() => {
    let mounted: boolean = true;
    if (mounted && locationPermission) {
      (async () => {
        const { coords } = await Location.getCurrentPositionAsync();
        dispatch(setMyLocation(coords));
      })();
    }
    return () => {
      mounted = false;
    };
  }, [locationPermission, dispatch]);
  React.useEffect(() => {
    let mounted: boolean = true;
    if (mounted && !!mySettings?.settings) {
      dispatch(setUserSettings(mySettings.settings));
    }
    return () => {
      mounted = false;
    };
  }, [mySettings, dispatch]);

  return (
    <Tab.Navigator
      initialRouteName="Messages"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          elevation: 0,
          shadowOpacity: 0,
          borderTopWidth: 0,
          borderColor: "transparent",
          backgroundColor: COLORS.main,
          paddingVertical: 10,
          height: 80,
          width: "auto",
        },
        tabBarShowLabel: false,
        tabBarBadgeStyle: {
          backgroundColor: COLORS.primary,
          color: "white",
          fontSize: 16,
          position: "absolute",
          top: -5,
          fontFamily: FONTS.regularBold,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarVisibilityAnimationConfig: {
          hide: {
            animation: "timing",
          },
          show: {
            animation: "spring",
          },
        },
        tabBarItemStyle: {
          width: "auto",
        },
      }}
    >
      <Tab.Screen
        name="Messages"
        component={Messages}
        options={{
          tabBarIcon: (props) => (
            <TabIcon
              {...props}
              title="chats"
              Icon={{
                name: "chatbubble-ellipses",
                IconComponent: Ionicons,
              }}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarIcon: (props) => (
            <TabIcon
              {...props}
              title="profile"
              Icon={{
                name: "user",
                IconComponent: AntDesign,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          tabBarIcon: (props) => (
            <TabIcon
              {...props}
              title="settings"
              Icon={{
                name: "settings",
                IconComponent: Feather,
              }}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default App;
