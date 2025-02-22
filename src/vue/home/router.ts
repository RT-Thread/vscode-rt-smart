import { createRouter, createWebHashHistory } from "vue-router";
import CreatProject from './view/create-project/index.vue'
import Environment from './view/environment/index.vue'
import SymbolicAnalysis from './view/symbolic-analysis/index.vue'
import Config from './view/config/index.vue'
import LayoutView from './view/layout/index.vue'

export const routes = [
    {
        path: '/',
        component: LayoutView,
        meta: {
            title: '创建工程'
        },
        redirect: '/',
        children: [
            {
                path: '/',
                component: CreatProject,
                meta: {
                    title: '创建工程'
                }
            },
        ]
    },
    {
        path: '/environment',
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
                },
            },
        ]
    },
    {
        path: '/symbolic-analysis',
        component: LayoutView,
        meta: {
            title: '符号分析',
            hidden: true
        },
        redirect: '/symbolic-analysis',
        children: [
            {
                path: '/symbolic-analysis',
                component: SymbolicAnalysis,
                meta: {
                    title: '符号分析',
                    hidden: true
                },
            },
        ]
    },
    {
        path: '/config',
        component: LayoutView,
        meta: {
            title: '配置'
        },
        redirect: '/config',
        children: [
            {
                path: '/config',
                component: Config,
                meta: {
                    title: '配置'
                },
            },
        ]
    }
]
const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router
