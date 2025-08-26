import { createRouter, createWebHashHistory } from "vue-router";
import Environment from './view/environment/index.vue';
import Sdk from './view/sdk/index.vue';
import Toolchains from './view/toolchains/index.vue';
import LayoutView from './view/layout/index.vue';

export const routes = [
    {
        path: '/',
        component: LayoutView,
        meta: {
            title: '环境工具'
        },
        redirect: '/environment',
        children: [
            {
                path: '/environment',
                component: Environment,
                meta: {
                    title: '环境工具'
                }
            },
        ]
    },
    {
        path: '/sdk',
        component: LayoutView,
        meta: {
            title: 'SDK管理器'
        },
        redirect: '/sdk',
        children: [
            {
                path: '/sdk',
                component: Sdk,
                meta: {
                    title: 'SDK管理器'
                },
            },
        ]
    },
    {
        path: '/toolchains',
        component: LayoutView,
        meta: {
            title: '工具链设置'
        },
        redirect: '/toolchains',
        children: [
            {
                path: '/toolchains',
                component: Toolchains,
                meta: {
                    title: '工具链设置'
                },
            },
        ]
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
