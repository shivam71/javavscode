/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* This file has been modified for Oracle Java SE extension */

'use strict';

import { commands, window, workspace, ExtensionContext, TextEditorDecorationType } from 'vscode';

import {
	StreamInfo
} from 'vscode-languageclient/node';

import * as vscode from 'vscode';
import { NbTestAdapter } from './testAdapter';
import { SetTextEditorDecorationParams} from './lsp/protocol';
import * as launchConfigurations from './launchConfigurations';
import { TreeViewService, Visualizer } from './explorer';
import { initializeRunConfiguration, runConfigurationProvider, runConfigurationNodeProvider, configureRunSettings } from './runConfiguration';
import { PropertiesView } from './propertiesView/propertiesView';
import { extConstants } from './constants';
import { ExtensionInfo } from './extensionInfo';
import { ClientPromise } from './lsp/clientPromise';
import { ExtensionLogger } from './logger';
import { NbProcessManager } from './lsp/nbProcessManager';
import { initializeServer } from './lsp/initializer';
import { NbLanguageClient } from './lsp/nbLanguageClient';
import { subscribeCommands } from './commands/register';
import { VSNetBeansAPI } from './lsp/types';
import { registerListenersAfterClientInit, registerListenersBeforeClientInit } from './listener';
import { registerNotificationListeners } from './lsp/notifications/register';
import { registerRequestListeners } from './lsp/requests/register';
import { registerDebugger } from './debugger/debugger';

export let LOGGER: ExtensionLogger;
export namespace globalVars {
    export const listeners = new Map<string, string[]>();    
    export let extensionInfo: ExtensionInfo;
    export let clientPromise: ClientPromise;
    export let debugPort: number = -1;
    export let debugHash: string | undefined;
    export let deactivated: boolean = true;
    export let nbProcessManager: NbProcessManager | null;
    export let testAdapter: NbTestAdapter | undefined;
    export let decorations = new Map<string, TextEditorDecorationType>();
    export let decorationParamsByUri = new Map<vscode.Uri, SetTextEditorDecorationParams>();
}

function contextUri(ctx : any) : vscode.Uri | undefined {
    if (ctx?.fsPath) {
        return ctx as vscode.Uri;
    } else if (ctx?.resourceUri) {
        return ctx.resourceUri as vscode.Uri;
    } else if (typeof ctx == 'string') {
        try {
            return vscode.Uri.parse(ctx, true);
        } catch (err) {
            return vscode.Uri.file(ctx);
        }
    }
    return vscode.window.activeTextEditor?.document?.uri;
}

export function activate(context: ExtensionContext): VSNetBeansAPI {
    globalVars.deactivated = false;
    globalVars.clientPromise = new ClientPromise();
    globalVars.extensionInfo = new ExtensionInfo(context);
    LOGGER = new ExtensionLogger(extConstants.SERVER_NAME);

    globalVars.clientPromise.initialize();
    registerListenersBeforeClientInit();
    doActivateWithJDK();

    //register debugger:
    registerDebugger(context);
    // initialize Run Configuration
    initializeRunConfiguration().then(initialized => {
		if (initialized) {
			context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, runConfigurationProvider));
			context.subscriptions.push(vscode.window.registerTreeDataProvider('run-config', runConfigurationNodeProvider));
			context.subscriptions.push(vscode.commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.configureRunSettings', (...params: any[]) => {
				configureRunSettings(context, params);
			}));
			vscode.commands.executeCommand('setContext', 'runConfigurationInitialized', true);
		}
	});

    // register commands
    subscribeCommands(context);

    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.node.properties.edit',
        async (node) => await PropertiesView.createOrShow(context, node, (await globalVars.clientPromise.client).findTreeViewService())));

    const archiveFileProvider = <vscode.TextDocumentContentProvider> {
        provideTextDocumentContent: async (uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> => {
            return await commands.executeCommand(extConstants.COMMAND_PREFIX + '.get.archive.file.content', uri.toString());
        }
    };
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('jar', archiveFileProvider));
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('nbjrt', archiveFileProvider));

    launchConfigurations.updateLaunchConfig();

    // register completions:
    launchConfigurations.registerCompletion(context);
    return Object.freeze({
        version : extConstants.API_VERSION,
        apiVersion : extConstants.API_VERSION
    });
}

function doActivateWithJDK(): void {
        const connection: () => Promise<StreamInfo> = initializeServer();
        const client = NbLanguageClient.build(connection, LOGGER);
        
        LOGGER.log('Language Client: Starting');
        client.start().then(() => {
            globalVars.testAdapter = new NbTestAdapter();
            registerListenersAfterClientInit();
            registerNotificationListeners(client);
            registerRequestListeners(client);
            LOGGER.log('Language Client: Ready');
            globalVars.clientPromise.initializedSuccessfully(client);
        
            createProjectView(client);
        }).catch(globalVars.clientPromise.setClient[1]);
}
    async function createProjectView(client : NbLanguageClient) {
        const ts : TreeViewService = client.findTreeViewService();
        let tv : vscode.TreeView<Visualizer> = await ts.createView('foundProjects', 'Projects', { canSelectMany : false });

        async function revealActiveEditor(ed? : vscode.TextEditor) {
            const uri = window.activeTextEditor?.document?.uri;
            if (!uri || uri.scheme.toLowerCase() !== 'file') {
                return;
            }
            if (!tv.visible) {
                return;
            }
            let vis : Visualizer | undefined = await ts.findPath(tv, uri.toString());
            if (!vis) {
                return;
            }
            tv.reveal(vis, { select : true, focus : false, expand : false });
        }
        const netbeansConfig = workspace.getConfiguration(extConstants.COMMAND_PREFIX);
        globalVars.extensionInfo.pushSubscription(window.onDidChangeActiveTextEditor(ed => {
            if (netbeansConfig.get("revealActiveInProjects")) {
                revealActiveEditor(ed);
            }
        }));
        globalVars.extensionInfo.pushSubscription(vscode.commands.registerCommand(extConstants.COMMAND_PREFIX + ".select.editor.projects", () => revealActiveEditor()));

        // attempt to reveal NOW:
        if (netbeansConfig.get("revealActiveInProjects")) {
            revealActiveEditor();
        }
    }


export function deactivate(): Thenable<void> {
    if (globalVars.nbProcessManager?.getProcess() != null) {
        globalVars.nbProcessManager?.getProcess()?.kill();
    }
    return globalVars.clientPromise.stopClient();
}

