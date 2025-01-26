export let cmds: Object = {
    Build : {
        subcmds: [
            {
                name : "clean",
                iconId : "clear-all",
                cmd : {
                    title : "clean",
                    arguments : [
                        "scons -c"
                    ]
                }
            },
            {
                name : "clean & build",
                iconId : "clear-all",
                cmd : {
                    title : "clean & build",
                    arguments : [
                        "scons -c",
                        "scons -j$(cpus)"
                    ]
                }
            },
            {
                name : "build -cpu=$(cpus)",
                iconId : "zap",
                cmd : {
                    title : "build",
                    arguments : [
                        "scons -j$(cpus)"
                    ]
                }
            }
        ],
        name: 'Build',
        iconId: 'github-action',
        label: 'build',
        isExpanded: true
    },
    Settings : {
        subcmds : [
            {
                name : "menuconfig",
                iconId : "checklist",
                cmd : {
                    title : "menuconfig",
                    arguments : [
                        "scons --menuconfig"
                    ]
                }
            },
            {
                name : "vscode settings",
                iconId : "compare-changes",
                cmd : {
                    title : "vscode",
                    arguments : [
                        "scons --cdb -n -s",
                        "scons --target=vsc -n -s"
                    ]
                }
            },
            {
                name : "sdk settings",
                iconId : "settings",
                cmd : {
                    title : "sdk-setting",
                    arguments : [
                        "sdk"
                    ]
                }
            }
        ],
        name: 'Settings',
        iconId: 'gear',
        label: 'settings',
        isExpanded: true
    },
    Packages : {
        subcmds: [
            {
                name : "list",
                iconId : "list-unordered",
                cmd : {
                    title : "packages-list",
                    arguments : [
                        "pkgs --list"
                    ]
                }
            },
            {
                name : "update",
                iconId : "sync",
                cmd : {
                    title : "packages-update",
                    arguments : [
                        "pkgs --update"
                    ]
                }
            }
        ],
        name: 'Packages',
        iconId: 'extensions',
        label: 'packages',
        isExpanded: false
    }
}
