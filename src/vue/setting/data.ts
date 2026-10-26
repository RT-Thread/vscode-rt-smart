import { ref } from 'vue';

export interface EnvStatus {
    installed: boolean;
    path: string;
    envVersion?: string;
    envGitRev?: string;
}

export interface RootConfig {
    name: string;
    path: string;
    description: string;
}

export const envInfo = ref({
    envStatus: { installed: false, path: '~/.env' } as EnvStatus,
    rtConfig: {
        name: 'RT-Thread',
        path: '',
        description: 'RT-Thread 主干版本',
    } as RootConfig,
});
