import { ExtensionContext, TextDocumentContentProvider, Uri, commands, workspace } from "vscode";
import { nbCommands } from "../../commands/commands";
import { Disposable } from "vscode-languageclient";

const archiveFileProvider = <TextDocumentContentProvider> {
    provideTextDocumentContent: async (uri: Uri): Promise<string> => {
        return await commands.executeCommand(nbCommands.archiveFileContent, uri.toString());
    }
};

const textDocumentContentProvider: Disposable[] = [
    workspace.registerTextDocumentContentProvider('nbjrt', archiveFileProvider),
    workspace.registerTextDocumentContentProvider('jar', archiveFileProvider)
]

export const registerFileProviders = (context: ExtensionContext) => {
    textDocumentContentProvider.forEach((provider: Disposable) =>{
        context.subscriptions.push(provider);
    })
}
