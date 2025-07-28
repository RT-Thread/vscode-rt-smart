import { ref } from 'vue';

// data model
export let extensionInfo = ref<any>({
    envRoot: "~/.env",
    version: "0.4.11"
});

export let projectInfo = ref<any>({
    folder: "",
    name: "",
    board: "",
    manufacturer: "",
    projectList: [
        {
            manufacturer: "stm32",
            boards: [
                "stm32f407-rt-spark"
            ],
        },
        {
            manufacturer: "qemu",
            boards: [
                "qemu-vexpress-a9"
            ]
        }
    ],
    linkRTT: false,
    linkDriver: false,
    readme: "README.md"
});

export const analysisInfo = ref<any>({
    mapFile: "rt-thread.map",
    mapFileUrl: "",
    analysisTableList: [
        {
            title: "全部符号",
            children: [
                {
                    name: "name01",
                    path: "0x00",
                    size: "12",
                },
                {
                    name: "name02",
                    path: "0x20",
                    size: "16",
                },
            ]
        },
        {
            title: "按文件",
            children: [
                {
                    name: "file01",
                    path: "0x00",
                    size: "12",
                },
                {
                    name: "file02",
                    path: "0x20",
                    size: "16",
                },
            ]
        },
        {
            title: "按Groups",
            children: [
                {
                    name: "Groups01",
                    path: "0x00",
                    size: "12",
                },
                {
                    name: "Groups02",
                    path: "0x20",
                    size: "16",
                },
            ]
        }
    ],
    analysisTitleList: [
        {
            title: "名称",
            field: "name",
        },
        {
            title: "地址",
            field: "path",
        },
        {
            title: "大小",
            field: "size",
        },
    ]
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

    version : "v2.0.1",
    path: "~/.env",
    
    // RT-Thread 根目录配置
    rtThreadConfig: {
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
