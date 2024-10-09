import { NbLanguageClient } from "../nbLanguageClient"
import { notificationOrRequestListenerType } from "../types"
import { requestListeners } from "./handlers"

export const registerRequestListeners = (client: NbLanguageClient) => {
    requestListeners.forEach((listener: notificationOrRequestListenerType) => {
        const { type, handler } = listener;
        client.onRequest(type, handler);
    })
}