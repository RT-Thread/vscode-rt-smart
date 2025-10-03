import { ref } from 'vue';

// data model
export let extensionInfo = ref<any>({
    envRoot: "~/.env",
    version: "0.4.11"
});

export const envInfo = ref<any>({
    progressNum: 0,
    selectRow: null,

    // Env 安装状态相关
    envStatus: {
        installed: false,
        path: "~/.env",
        envVersion: undefined,
        envGitRev: undefined
    },
    isInstalling: false,
    installProgress: [],
    showProgressLog: false,
    showForceCloseButton: false, // 控制强制关闭按钮的显示

    version : "v2.0.1",
    path: "~/.env",
    
    // RT-Thread 根目录配置
    rtConfig: {
        name: "RT-Thread",
        path: "d:/workspace/rt-thread",
        description: "RT-Thread 主干版本"
    },
    rtConfigDialogVisible: false,
    editRtConfig: {
        name: "",
        path: "",
        description: ""
    },
    
    radioChange: 0,
});

export const sdkInfo = ref<any>({
    selectRow: null,
    sdkTitleList: [
        {
            title: "名称",
            field: "name",
        },
        {
            title: "路径",
            field: "path",
        },
        {
            title: "描述",
            field: "description",
        },
    ],
    sdkData: [
        {
            name: "gcc",
            path: "d:/tools/toolchains/arm-none-eabi-gcc",
            description: "ARM GNU GCC",
        }
    ],
    dialogVisible: false,
    editMode: false,
    addToolchain: {
        name: "",
        path: "",
        description: ""
    }
});
