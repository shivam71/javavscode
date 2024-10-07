import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { CloseAction, CloseHandlerResult, DocumentSelector, ErrorAction, ErrorHandlerResult, Message, RevealOutputChannelOn } from "vscode-languageclient";
import { createTreeViewService, TreeViewService } from "../explorer";
import { OutputChannel, workspace } from "vscode";
import { extConstants } from "../constants";
import { userConfigsListenedByServer } from '../configurations/configuration';
import { collectDocumentSelectors, restartWithJDKLater } from './utils';
import { ExtensionLogger, LogLevel } from '../logger';
import { globalVars } from '../extension';


export class NbLanguageClient extends LanguageClient {
    private _treeViewService: TreeViewService;
    constructor(id: string, name: string, s: ServerOptions, log: OutputChannel, c: LanguageClientOptions) {
        super(id, name, s, c);
        this._treeViewService = createTreeViewService(log, this);
    }

    static build = (serverOptions: ServerOptions, logger: ExtensionLogger): NbLanguageClient => {
        let documentSelectors: DocumentSelector = [
            { language: extConstants.LANGUAGE_ID },
            { language: 'yaml', pattern: '**/{application,bootstrap}*.yml' },
            { language: 'properties', pattern: '**/{application,bootstrap}*.properties' },
            { language: 'jackpot-hint' },
            { language: 'xml', pattern: '**/pom.xml' },
            { pattern: '**/build.gradle' }
        ];
        // TODO: Decide whether to collect document selector from other extensions as well or not?
        documentSelectors.push(...collectDocumentSelectors());

        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            // Register the server for java documents
            documentSelector: documentSelectors,
            synchronize: {
                configurationSection: userConfigsListenedByServer,
                fileEvents: [
                    workspace.createFileSystemWatcher('**/*.java')
                ]
            },
            outputChannel: logger.getOutputChannel(),
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            progressOnInitialization: true,
            initializationOptions: {
                'nbcodeCapabilities': {
                    'statusBarMessageSupport': true,
                    'testResultsSupport': true,
                    'showHtmlPageSupport': true,
                    'wantsJavaSupport': true,
                    'wantsGroovySupport': false,
                    'commandPrefix': extConstants.COMMAND_PREFIX,
                    'configurationPrefix': 'jdk.',
                    'altConfigurationPrefix': 'jdk.'
                }
            },
            errorHandler: {
                error: function (error: Error, _message: Message, count: number): ErrorHandlerResult {
                    return { action: ErrorAction.Continue, message: error.message };
                },
                closed: function (): CloseHandlerResult {
                    logger.log(`Connection to ${extConstants.SERVER_NAME} closed.`, LogLevel.WARN);
                    if (!globalVars.clientPromise.activationPending) {
                        restartWithJDKLater(10000, false);
                    }
                    return { action: CloseAction.DoNotRestart };
                }
            }
        }

        return new NbLanguageClient(
            extConstants.NB_LANGUAGE_CLIENT_ID,
            extConstants.NB_LANGUAGE_CLIENT_NAME,
            serverOptions,
            logger.getOutputChannel(),
            clientOptions
        )
    }

    findTreeViewService(): TreeViewService {
        return this._treeViewService;
    }

    stop(): Promise<void> {
        const r: Promise<void> = super.stop();
        this._treeViewService.dispose();
        return r;
    }

}