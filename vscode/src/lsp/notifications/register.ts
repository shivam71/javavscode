import { NbLanguageClient } from "../nbLanguageClient"
import { notificationOrRequestListenerType } from "../types"
import { notificationListeners } from "./handlers"

export const registerNotificationListeners = (client: NbLanguageClient) => {
    notificationListeners.forEach((listener: notificationOrRequestListenerType) => {
        const { type, handler } = listener;
        client.onNotification(type, handler);
    })
} 