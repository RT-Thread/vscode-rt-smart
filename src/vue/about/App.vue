<template>
    <div class="container">
        <img class="logo_img" :src="imgUrl['head-logo']" alt="" />
        <br>
        <div v-html="readmeMarkdown"></div>

        <el-button type="primary" @click="openRTThreadGitHub">Open RT-Thread/Github</el-button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { imgUrl } from '../assets/img';
import { sendCommand } from '../api/vscode';

let readmeMarkdown = ref('');

const openRTThreadGitHub = () => {
    sendCommand('openURL', ['https://github.com/RT-Thread/rt-thread']);
};

onMounted(() => {
    sendCommand('renderReadme');
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'setReadme':
                readmeMarkdown.value = message.data;
                break;

            default:
                break;
        }
    });
});
</script>

<style scoped>
.container {
    padding: 20px;
}
</style>
