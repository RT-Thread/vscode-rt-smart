<template>
    <div>
        <router-view></router-view>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated, ref } from 'vue';
import { extensionInfo, projectInfo, envInfo, configInfo } from "./data";
import { sendCommand } from '../api/vscode';

onUpdated(() => {
    console.log('App updated');
});

onMounted(() => {
    sendCommand('getExtensionInfo');
    window.addEventListener('message', event => {
        const message = event.data;
        // console.log(message);

        switch (message.command) {
            case 'extensionInfo':
                extensionInfo.value.version = message.data.version;
                projectInfo.value.projectList = message.data.projectList;

                envInfo.value.version = message.data.env.version;
                envInfo.value.path = message.data.env.path;
                envInfo.value.environmentData = message.data.SDKConfig;
                configInfo.value.configData = message.data.configInfo;
                break;

            case 'setToolchainFolder':
                // message like {command: 'setToolchainFolder', data: 'path'}
                envInfo.value.addToolchain.path = message.data;
                break;

            case 'setItemFolder':
                // message like {command: 'setItemFolder', data: 'path'}
                configInfo.value.editConfigItem.path = message.data;
                break;

            case 'setProjectFolder':
                // message like {command: 'setProjectFolder', data: 'path'}
                projectInfo.value.folder = message.data;
                break;

            case 'setSDKConfig':
                envInfo.value.environmentData = message.data;
                break;

            default:
                break;
        }
    });
});

</script>
<style>
* {
    margin: 0;
    padding: 0;
}
</style>
