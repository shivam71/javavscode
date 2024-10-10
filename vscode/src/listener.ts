import { Disposable, TextEditor, window } from "vscode";
import { globalVars } from "./extension";
import { asRanges } from "./lsp/protocol";

// TODO: Move to views folder as listeners after it is refactored

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

const visibleTextEditorsChangeListener = window.onDidChangeVisibleTextEditors(visibleTextEditorsChangeHandler);

const afterInitlisteners: Disposable[] = [visibleTextEditorsChangeListener];

export const registerListenersAfterClientInit = () => {
    afterInitlisteners.forEach(listener => {
        globalVars.extensionInfo.pushSubscription(listener);
    });
}