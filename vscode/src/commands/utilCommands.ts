import { globalVars } from "../extension";
import { extCommands } from "./commands";
import { ICommand } from "./types";

const startupConditionHandler = () => {
    return globalVars.clientPromise.client;
}

const addEventListenerHandler = async (eventName: any, listener: any) => {
    let ls = globalVars.listeners.get(eventName);
    if (!ls) {
        ls = [];
        globalVars.listeners.set(eventName, ls);
    }
    ls.push(listener);
}


export const registerUtilCommands: ICommand[] = [
    {
        command: extCommands.startupCondition,
        handler: startupConditionHandler
    }, {
        command: extCommands.nbEventListener,
        handler: addEventListenerHandler
    }
];