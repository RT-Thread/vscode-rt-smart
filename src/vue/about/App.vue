<template>
    <div class="container">
        <img class="logo_img" :src="imgUrl['head-logo']" alt="" />
        <br>
        <div v-html="readmeMarkdown"></div>

        <el-button type="primary">Open RT-Thread/Github</el-button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { imgUrl } from '../assets/img';
import { sendCommand } from '../api/vscode';

let readmeMarkdown = ref('');

onMounted(() => {
    sendCommand('renderReadme');
    window.addEventListener('message', event => {
        const message = event.data;
        console.log(message);

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
