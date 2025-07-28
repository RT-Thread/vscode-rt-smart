import { ref } from 'vue';

// data model for create project
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

export let envInfo = ref<any>({
    version: "0.0.1",
    path: "~/.env",
    rtConfig: {
        path: ""
    }
});
