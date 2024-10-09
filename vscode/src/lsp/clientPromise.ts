import { commands } from "vscode";
import { globalVars, LOGGER } from "../extension";
import { LogLevel } from "../logger";
import { NbProcessManager } from "./nbProcessManager";
import { clientInit, serverOptionsBuilder } from "./initializer";
import { NbLanguageClient } from "./nbLanguageClient";

export class ClientPromise {
    setClient!: [(c: NbLanguageClient) => void, (err: any) => void];
    client!: Promise<NbLanguageClient>;
    activationPending!: boolean;
    initialPromiseResolved: boolean = false;

    public initialize = (): void => {
        this.client = new Promise<NbLanguageClient>((clientOK, clientErr) => {
            this.setClient = [
                (c: NbLanguageClient) => {
                    clientOK(c);
                },
                (err: any) => {
                    clientErr(err);
                }
            ];
        });

        this.activationPending = true;
        commands.executeCommand('setContext', 'nbJdkReady', false);
    }

    public initializedSuccessfully = (client: NbLanguageClient) => {
        this.initialPromiseResolved = true;
        globalVars.clientPromise.setClient[0](client);
        commands.executeCommand('setContext', 'nbJdkReady', true);
    }

    public stopClient = async (): Promise<void> => {
        if (globalVars.testAdapter) {
            globalVars.testAdapter.dispose();
            globalVars.testAdapter = undefined;
        }
        if (!this.client) {
            return Promise.resolve();
        }

        return (await this.client).stop();
    }

    public restartExtension = async (nbProcessManager: NbProcessManager | null, notifyKill: boolean) => {
        if (this.activationPending) {
            LOGGER.log("Server activation requested repeatedly, ignoring...", LogLevel.WARN);
            return;
        }
        if (!nbProcessManager) {
            LOGGER.log("Nbcode Process is null", LogLevel.ERROR);
            return;
        }
        try {
            await this.stopClient();
            await nbProcessManager.killProcess(notifyKill);
            this.initialize();
            clientInit();
        } catch (error) {
            LOGGER.log(`Error during activation: ${error}`, LogLevel.ERROR);
            throw error;
        } finally {
            this.activationPending = false;
        }
    }

}