<template>
    <div class="container">
        <Banner sub-title="关于" />

        <div class="content_area">
            <div v-html="readmeMarkdown"></div>

            <el-button type="primary" @click="openRTThreadGitHub">Open RT-Thread/Github</el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { imgUrl } from '../assets/img';
import { sendCommand } from '../api/vscode';
import { extensionInfo } from '../setting/data';
import Banner from '../components/Banner.vue';

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
    padding: 0;
}

.header_box {
    background-color: #fff;
    border-bottom: 1px solid #e6e6e6;
    padding: 0 20px;
}

.header_logo {
    display: flex;
    align-items: center;
    column-gap: 12px;
    font-size: 18px;
    color: #333;
    height: 100%;

    .logo_img {
        width: 228px;
        height: 68px;
    }

    .logo_text {
        color: #333;
        padding-top: 15px;

        p {
            font-size: 18px;
            margin: 0;
        }

        span {
            font-size: 12px;
        }
    }
}

.content_area {
    padding: 20px;
}

.page_title {
    font-size: 16px;
    color: #666;
    margin-bottom: 20px;
    font-weight: 500;
}
</style>
