import { ConfigurationChangeEvent, ExtensionContext, workspace } from "vscode";
import { globalVars } from "../extension";
import { userConfigsListened } from "./configuration";
import { Disposable } from "vscode-languageclient";

const configChangeHandler = (params: ConfigurationChangeEvent) => {
    userConfigsListened.forEach((config: string) => {
        const doesAffect = params.affectsConfiguration(config);
        if (doesAffect) {
            globalVars.clientPromise.restartExtension(globalVars.nbProcessManager, true);
        }
    });
}

const configChangeListener = workspace.onDidChangeConfiguration(configChangeHandler);


const listeners: Disposable[] = [configChangeListener];

export const registerConfigChangeListeners = (context: ExtensionContext) => {
    listeners.forEach((listener: Disposable)=>{
        context.subscriptions.push(listener);
    });
}