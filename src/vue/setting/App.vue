<template>
    <div>
        <router-view></router-view>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated } from 'vue';
import { extensionInfo, envInfo } from "./data";
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

                envInfo.value.version = message.data.env.version;
                envInfo.value.path = message.data.env.path;
                
                // 设置RT-Thread配置数据
                if (message.data.configInfo && message.data.configInfo.length > 0) {
                    envInfo.value.rtConfig.path = message.data.configInfo[0].path || '';
                }
                break;

            case 'setToolchainFolder':
                // message like {command: 'setToolchainFolder', data: 'path'}
                // 这个消息现在由SDK管理器处理
                break;

            case 'setItemFolder':
                // message like {command: 'setItemFolder', data: 'path'}
                // 这个消息现在由environment页面处理
                break;

            case 'setSDKConfig':
                // SDK配置现在由SDK管理器页面处理
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
