import { commands, Uri, ViewColumn, Webview, window, workspace } from "vscode";
import { HtmlPageParams } from "../lsp/protocol";
import { globalVars } from "../extension";
import { nbCommands } from "../commands/commands";

const webviews = new Map<string, Webview>();

export const showHtmlPage = async (params: HtmlPageParams): Promise<void> => {
    return new Promise(resolve => {
        let data = params.text;
        const match = /<title>(.*)<\/title>/i.exec(data);
        const name = match && match.length > 1 ? match[1] : '';
        const resourceDir = Uri.joinPath(globalVars.extensionInfo.getGlobalStorage(), params.id);
        const distPath = Uri.joinPath(globalVars.extensionInfo.getExtensionStorageUri(), 'node_modules', '@vscode/codicons', 'dist');
        workspace.fs.createDirectory(resourceDir);
        let view = window.createWebviewPanel('htmlView', name, ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [resourceDir, distPath]
        });
        webviews.set(params.id, view.webview);
        const resources = params.resources;
        if (resources) {
            for (const resourceName in resources) {
                const resourceText = resources[resourceName];
                const resourceUri = Uri.joinPath(resourceDir, resourceName);
                workspace.fs.writeFile(resourceUri, Buffer.from(resourceText, 'utf8'));
                data = data.replace(`href="${resourceName}"`, `href="${view.webview.asWebviewUri(resourceUri)}"`);
            }
        }
        const codiconsUri = view.webview.asWebviewUri(Uri.joinPath(distPath, 'codicon.css'));
        view.webview.html = data.replace('href="codicon.css"', `href="${codiconsUri}"`);
        view.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'dispose':
                    webviews.delete(params.id);
                    view.dispose();
                    break;
                case 'command':
                    commands.executeCommand(nbCommands.htmlProcessCmd, message.data);
                    break;
            }
        });
        view.onDidDispose(() => {
            resolve();
            workspace.fs.delete(resourceDir, { recursive: true });
        });
    });
}

export const execInHtmlPage = (params: HtmlPageParams): Promise<boolean> => {
    return new Promise(resolve => {
        const webview = webviews.get(params.id);
        if (webview) {
            webview.postMessage({
                execScript: params.text,
                pause: params.pause
            }).then(ret => {
                resolve(ret);
            });
        }
        resolve(false);
    });
}