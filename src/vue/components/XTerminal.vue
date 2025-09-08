<template>
    <div ref="terminalRef" class="xterm-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// Props
interface Props {
    rows?: number;
    cols?: number;
    fontSize?: number;
    fontFamily?: string;
    theme?: any;
    scrollback?: number;
    cursorBlink?: boolean;
    convertEol?: boolean;
    disableStdin?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    rows: 20,
    cols: 80,
    fontSize: 13,
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    theme: () => ({
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd93d',
        blue: '#339af0',
        magenta: '#ae3ec9',
        cyan: '#22b8cf',
        white: '#d4d4d4',
        brightBlack: '#868e96',
        brightRed: '#ff8787',
        brightGreen: '#8ce99a',
        brightYellow: '#ffe066',
        brightBlue: '#74c0fc',
        brightMagenta: '#d0bfff',
        brightCyan: '#66d9e8',
        brightWhite: '#ffffff'
    }),
    scrollback: 5000,
    cursorBlink: false,
    convertEol: true,
    disableStdin: true
});

// Emits
const emit = defineEmits<{
    ready: [terminal: Terminal];
    data: [data: string];
}>();

// Refs
const terminalRef = ref<HTMLElement>();
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;

// Initialize terminal
const initTerminal = () => {
    if (!terminalRef.value || terminal) return;
    
    // Create terminal instance
    terminal = new Terminal({
        rows: props.rows,
        cols: props.cols,
        fontSize: props.fontSize,
        fontFamily: props.fontFamily,
        theme: props.theme,
        scrollback: props.scrollback,
        cursorBlink: props.cursorBlink,
        convertEol: props.convertEol,
        disableStdin: props.disableStdin
    });
    
    // Create fit addon
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Mount to DOM
    terminal.open(terminalRef.value);
    
    // Listen for terminal input (if not disabled)
    if (!props.disableStdin) {
        terminal.onData((data) => {
            emit('data', data);
        });
    }
    
    // Fit to container
    nextTick(() => {
        fit();
        // Emit ready event
        if (terminal) {
            emit('ready', terminal);
        }
    });
};

// Fit terminal to container
const fit = () => {
    if (fitAddon) {
        fitAddon.fit();
    }
};

// Write to terminal
const write = (text: string) => {
    if (terminal) {
        terminal.write(text);
    }
};

// Write line to terminal
const writeln = (text: string) => {
    if (terminal) {
        terminal.writeln(text);
    }
};

// Clear terminal
const clear = () => {
    if (terminal) {
        terminal.clear();
    }
};

// Reset terminal
const reset = () => {
    if (terminal) {
        terminal.reset();
    }
};

// Scroll to bottom
const scrollToBottom = () => {
    if (terminal) {
        terminal.scrollToBottom();
    }
};

// Scroll to top
const scrollToTop = () => {
    if (terminal) {
        terminal.scrollToTop();
    }
};

// Get terminal instance
const getTerminal = () => terminal;

// Expose methods
defineExpose({
    write,
    writeln,
    clear,
    reset,
    fit,
    scrollToBottom,
    scrollToTop,
    getTerminal
});

// Lifecycle
onMounted(() => {
    initTerminal();
    
    // Listen for window resize
    const resizeObserver = new ResizeObserver(() => {
        fit();
    });
    
    if (terminalRef.value) {
        resizeObserver.observe(terminalRef.value);
    }
    
    // Store observer for cleanup
    (window as any).__xtermResizeObserver = resizeObserver;
});

onUnmounted(() => {
    // Clean up resize observer
    const resizeObserver = (window as any).__xtermResizeObserver;
    if (resizeObserver) {
        resizeObserver.disconnect();
        delete (window as any).__xtermResizeObserver;
    }
    
    // Clean up terminal
    if (terminal) {
        terminal.dispose();
        terminal = null;
    }
    
    if (fitAddon) {
        fitAddon.dispose();
        fitAddon = null;
    }
});
</script>

<style scoped>
.xterm-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
}

:deep(.xterm) {
    padding: 10px;
}

:deep(.xterm-viewport) {
    background-color: transparent !important;
}

:deep(.xterm-screen) {
    height: 100% !important;
}
</style>