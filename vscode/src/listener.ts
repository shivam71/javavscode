import { ConfigurationChangeEvent, Disposable, TextEditor, window, workspace } from "vscode";
import { userConfigsListened } from "./configurations/configuration";
import { globalVars } from "./extension";
import { asRanges } from "./lsp/protocol";

const configChangeHandler = (params: ConfigurationChangeEvent) => {
    userConfigsListened.forEach((config: string) => {
        const doesAffect = params.affectsConfiguration(config);
        if (doesAffect) {
            globalVars.clientPromise.restartExtension(globalVars.nbProcessManager, true);
        }
    });
}

const visibleTextEditorsChangeHandler = (editors: readonly TextEditor[]) => {
    editors.forEach((editor: any) => {
        let decorationParams = globalVars.decorationParamsByUri.get(editor.document.uri);
        if (decorationParams) {
            let decorationType = globalVars.decorations.get(decorationParams.key);
            if (decorationType) {
                editor.setDecorations(decorationType, asRanges(decorationParams.ranges));
            }
        }
    });
}

const configChangeListener = workspace.onDidChangeConfiguration(configChangeHandler);
const visibleTextEditorsChangeListener = window.onDidChangeVisibleTextEditors(visibleTextEditorsChangeHandler);

const beforeInitlisteners: Disposable[] = [configChangeListener];
const afterInitlisteners: Disposable[] = [visibleTextEditorsChangeListener];


export const registerListenersBeforeClientInit = () => {
    beforeInitlisteners.forEach(listener => {
        globalVars.extensionInfo.pushSubscription(listener);
    });
}

export const registerListenersAfterClientInit = () => {
    afterInitlisteners.forEach(listener => {
        globalVars.extensionInfo.pushSubscription(listener);
    });
}